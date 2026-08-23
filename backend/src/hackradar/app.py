from __future__ import annotations

import ipaddress
import uuid
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from pathlib import Path
from urllib.parse import urlparse

import httpx
from fastapi import BackgroundTasks, Depends, FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from openai import APIError, AsyncOpenAI
from sqlalchemy.exc import SQLAlchemyError

from hackradar.clients.brightdata import BrightDataClient, BrightDataError
from hackradar.config import Settings
from hackradar.contracts import (
    HealRequest,
    RefreshRequest,
    SourceCreate,
    normalize_collector_row,
)
from hackradar.database import EXPECTED_FIELDS, Database, SourceRow, StudioJobRow
from hackradar.services.collector_cli import CollectorCLI, CollectorCLIError
from hackradar.services.prompts import PromptBuilder
from hackradar.services.refresh import RefreshService, inspect_rows


def public_target(value: str) -> str:
    parsed = urlparse(value)
    host = (parsed.hostname or "").lower()
    if parsed.scheme != "https" or not host or parsed.username or parsed.password:
        raise ValueError("targetUrl must be public HTTPS")
    if host == "localhost" or host.endswith((".local", ".internal", ".gov", ".gov.uk", ".gov.sg")):
        raise ValueError("targetUrl is outside the public-data boundary")
    try:
        address = ipaddress.ip_address(host)
        if address.is_private or address.is_loopback or address.is_link_local:
            raise ValueError("targetUrl must not use a private address")
    except ValueError as error:
        if "private address" in str(error):
            raise
    return value


def create_app(settings: Settings | None = None, database: Database | None = None) -> FastAPI:
    settings = settings or Settings()
    database = database or Database(settings.database_url)

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        database.create()
        database.seed_sources()
        package_root = Path(__file__).resolve().parents[2]
        seed_paths = (package_root / "data" / "hackathons.json", package_root.parent / "data" / "hackathons.json")
        if seed_path := next((path for path in seed_paths if path.exists()), None):
            database.seed_hackathons(seed_path)
        client = httpx.AsyncClient(timeout=httpx.Timeout(20.0))
        app.state.http_client = client
        try:
            yield
        finally:
            await client.aclose()

    app = FastAPI(title="HackRadar API", version="0.1.0", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware, allow_origins=settings.origins, allow_methods=["GET", "POST"],
        allow_headers=["Content-Type", "X-HackRadar-Operator-Token"],
    )

    def operator(x_hackradar_operator_token: str | None = Header(default=None)) -> None:
        if not settings.operator_token or x_hackradar_operator_token != settings.operator_token:
            raise HTTPException(status_code=401, detail={"error": "Operator authentication is required."})

    def job(kind: str, slug: str) -> StudioJobRow:
        now = datetime.now(UTC)
        value = StudioJobRow(id=uuid.uuid4().hex, kind=kind, source_slug=slug, status="queued", created_at=now, updated_at=now)
        database.put_job(value)
        return value

    def update_job(value: StudioJobRow, status: str, result: dict[str, object] | None = None, error: str | None = None) -> None:
        value.status, value.result, value.error, value.updated_at = status, result, error, datetime.now(UTC)
        database.put_job(value)

    def tooling() -> tuple[CollectorCLI, PromptBuilder]:
        if not settings.brightdata_api_key or not settings.openai_api_key:
            raise RuntimeError("Provider tooling is not configured.")
        return (
            CollectorCLI(settings.brightdata_api_key, settings.collector_cli_timeout_seconds),
            PromptBuilder(AsyncOpenAI(api_key=settings.openai_api_key)),
        )

    async def create_source_task(value: StudioJobRow, request: SourceCreate) -> None:
        try:
            cli, prompts = tooling()
            update_job(value, "running")
            prompt = await prompts.for_new_source(request.target_url, request.goal)
            result = await cli.create(request.target_url, prompt, f"hackradar-{request.slug}")
            collector_id = result.get("collector_id")
            if not isinstance(collector_id, str) or not collector_id.startswith("c_"):
                raise RuntimeError("Collector creation returned no stable ID.")
            database.upsert_source(SourceRow(
                slug=request.slug, name=request.name, target_url=request.target_url,
                collector_id=collector_id, country=request.country, state=str(result.get("status", "generated")),
                expected_schema=EXPECTED_FIELDS,
            ))
            update_job(value, "completed", {"collectorId": collector_id, "status": result.get("status")})
        except (APIError, CollectorCLIError, RuntimeError, SQLAlchemyError):
            update_job(value, "failed", error="Collector creation failed safely.")

    async def heal_task(value: StudioJobRow, source: SourceRow, problem: str) -> None:
        try:
            cli, prompts = tooling()
            update_job(value, "running")
            prompt = await prompts.for_drift(source.collector_id, [problem], [])
            result = await cli.heal(source.collector_id, prompt, source.target_url)
            update_job(value, str(result.get("status", "awaiting_approval")), {"collectorId": source.collector_id})
        except (APIError, CollectorCLIError, RuntimeError, SQLAlchemyError):
            update_job(value, "failed", error="Same-ID healing failed safely.")

    async def approve_task(value: StudioJobRow, source: SourceRow) -> None:
        try:
            cli, _prompts = tooling()
            update_job(value, "running")
            result = await cli.approve(source.collector_id)
            source.state = str(result.get("status", "ready"))
            database.upsert_source(source)
            update_job(value, "completed", {"collectorId": source.collector_id, "status": source.state})
        except (CollectorCLIError, RuntimeError, SQLAlchemyError):
            update_job(value, "failed", error="Collector approval failed safely.")

    async def refresh_task(value: StudioJobRow, source: SourceRow) -> None:
        try:
            if not settings.brightdata_api_key:
                raise RuntimeError("Bright Data is not configured.")
            update_job(value, "running")
            client = BrightDataClient(settings.brightdata_api_key, app.state.http_client)
            report = await RefreshService(client).run(source.collector_id, source.target_url)
            report = inspect_rows(report.rows, source.expected_schema)
            normalized = [
                item for raw in report.rows
                if (item := normalize_collector_row(raw, source_name=source.name, source_country=source.country))
            ]
            if not report.valid or not normalized:
                update_job(value, "drift_detected", {"collectorId": source.collector_id, "missingFields": report.missing_fields, "rowCount": len(report.rows)})
                if settings.auto_heal_enabled and settings.openai_api_key:
                    await heal_task(value, source, f"Missing fields: {', '.join(report.missing_fields) or 'rows do not normalize'}")
                return
            database.upsert_hackathons(normalized)
            source.last_good_schema, source.last_good_at, source.state = report.schema, datetime.now(UTC), "ready"
            database.upsert_source(source)
            update_job(value, "completed", {"collectorId": source.collector_id, "rows": len(normalized)})
        except (BrightDataError, CollectorCLIError, APIError, RuntimeError, SQLAlchemyError, ValueError):
            update_job(value, "failed", error="Refresh failed; last-known-good data was preserved.")

    @app.get("/healthz")
    async def healthz() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/hackathons")
    async def hackathons(
        country: str = Query(pattern="^(WORLD|US|IN|UK|SG)$"),
        category: str | None = Query(default=None, pattern="^(AI|Web3|Web|Mobile|Climate|Other)$"),
        limit: int = Query(default=10, ge=1, le=50),
    ) -> dict[str, object]:
        values = database.list_hackathons(country, category, limit)
        return {"country": country, "count": len(values), "hackathons": values}

    @app.get("/sources")
    async def sources() -> dict[str, object]:
        values = database.list_sources()
        return {"sources": [{"slug": item.slug, "name": item.name, "collectorId": item.collector_id, "country": item.country, "state": item.state} for item in values]}

    @app.post("/operators/sources", status_code=202, dependencies=[Depends(operator)])
    async def create_source(request: SourceCreate, background: BackgroundTasks) -> dict[str, str]:
        try:
            public_target(request.target_url)
            tooling()
        except (ValueError, RuntimeError) as error:
            raise HTTPException(status_code=503 if isinstance(error, RuntimeError) else 400, detail={"error": str(error)}) from error
        value = job("create", request.slug)
        background.add_task(create_source_task, value, request)
        return {"jobId": value.id, "status": value.status}

    @app.post("/operators/sources/{slug}/heal", status_code=202, dependencies=[Depends(operator)])
    async def heal(slug: str, request: HealRequest, background: BackgroundTasks) -> dict[str, str]:
        source = database.get_source(slug)
        if not source:
            raise HTTPException(status_code=404, detail={"error": "Unknown source."})
        value = job("heal", slug)
        background.add_task(heal_task, value, source, request.observed_problem)
        return {"jobId": value.id, "collectorId": source.collector_id, "status": value.status}

    @app.post("/operators/sources/{slug}/approve", status_code=202, dependencies=[Depends(operator)])
    async def approve(slug: str, background: BackgroundTasks) -> dict[str, str]:
        source = database.get_source(slug)
        if not source:
            raise HTTPException(status_code=404, detail={"error": "Unknown source."})
        value = job("approve", slug)
        background.add_task(approve_task, value, source)
        return {"jobId": value.id, "collectorId": source.collector_id, "status": value.status}

    @app.post("/operators/refresh", status_code=202, dependencies=[Depends(operator)])
    async def refresh(request: RefreshRequest, background: BackgroundTasks) -> dict[str, object]:
        selected = [database.get_source(request.source_slug)] if request.source_slug else database.list_sources()
        selected = [source for source in selected if source and source.state != "generation_failed"]
        jobs = []
        for source in selected:
            value = job("refresh", source.slug)
            background.add_task(refresh_task, value, source)
            jobs.append({"jobId": value.id, "sourceSlug": source.slug})
        return {"jobs": jobs}

    @app.get("/operators/jobs/{job_id}", dependencies=[Depends(operator)])
    async def get_job(job_id: str) -> dict[str, object]:
        value = database.get_job(job_id)
        if not value:
            raise HTTPException(status_code=404, detail={"error": "Unknown job."})
        return {"jobId": value.id, "kind": value.kind, "sourceSlug": value.source_slug, "status": value.status, "result": value.result, "error": value.error}

    return app


app = create_app()
