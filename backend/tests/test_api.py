from pathlib import Path

from fastapi.testclient import TestClient

from hackradar.app import create_app, public_target
from hackradar.config import Settings
from hackradar.contracts import Hackathon
from hackradar.database import Database
from hackradar.services.luma import LumaService
from hackradar.services.refresh import DriftReport, RefreshService
from hackradar.services.wemakedevs import WeMakeDevsService


def client(tmp_path: Path) -> TestClient:
    settings = Settings(database_url=f"sqlite:///{tmp_path / 'test.db'}", operator_token="offline-operator-token")
    return TestClient(create_app(settings, Database(settings.database_url)))


def test_country_feed_is_prize_ranked_and_seeded(tmp_path: Path) -> None:
    with client(tmp_path) as app:
        response = app.get("/hackathons", params={"country": "SG", "limit": 10})
    assert response.status_code == 200
    payload = response.json()
    assert payload["count"] == 10
    prizes = [item["prizeUsd"] if item["prizeUsd"] is not None else -1 for item in payload["hackathons"]]
    assert prizes == sorted(prizes, reverse=True)
    assert len({item["id"] for item in payload["hackathons"]}) == 10


def test_world_feed_is_deduplicated_and_prize_ranked(tmp_path: Path) -> None:
    settings = Settings(database_url=f"sqlite:///{tmp_path / 'world.db'}", operator_token="offline-operator-token")
    database = Database(settings.database_url)
    with TestClient(create_app(settings, database)) as app:
        first = app.get("/hackathons", params={"country": "WORLD", "limit": 50}).json()["hackathons"][0]
        mirror = {**first, "id": "mirror-provider-id", "source": "Mirror provider"}
        database.upsert_hackathons([Hackathon.model_validate(mirror)])
        response = app.get("/hackathons", params={"country": "WORLD", "limit": 50})
    assert response.status_code == 200
    payload = response.json()
    assert payload["count"] >= 10
    ids = [item["id"] for item in payload["hackathons"]]
    prizes = [item["prizeUsd"] if item["prizeUsd"] is not None else -1 for item in payload["hackathons"]]
    assert len(ids) == len(set(ids))
    assert prizes == sorted(prizes, reverse=True)
    assert sum(item["title"] == first["title"] for item in payload["hackathons"]) == 1


def test_hackathon_feed_rejects_unknown_markets(tmp_path: Path) -> None:
    with client(tmp_path) as app:
        response = app.get("/hackathons", params={"country": "ZZ", "limit": 10})
    assert response.status_code == 422


def test_release_seed_path_is_packaging_safe() -> None:
    source = Path(__file__).parents[1] / "src" / "hackradar" / "app.py"
    assert 'package_root / "data" / "hackathons.json"' in source.read_text()


def test_operator_routes_fail_closed_without_a_token(tmp_path: Path) -> None:
    with client(tmp_path) as app:
        response = app.post("/operators/refresh", json={})
    assert response.status_code == 401


def test_operator_can_refresh_a_custom_luma_source(tmp_path: Path, monkeypatch) -> None:
    async def rows(_service: LumaService, _slug: str, _country: str) -> list[dict[str, object]]:
        return [{
            "title": "Luma Agent Hack",
            "detail_url": "https://luma.com/test-hack",
            "organizer": "Luma event host",
            "location": "Singapore",
            "country": "SG",
            "start_date": "2026-10-01",
            "end_date": "2026-10-02",
            "registration_deadline": None,
            "prize_text": None,
            "prize_amount": None,
            "prize_currency": None,
            "themes": ["AI"],
            "eligibility": None,
            "participation_mode": "In person",
            "description": "A public AI hackathon.",
        }]

    monkeypatch.setattr(LumaService, "run", rows)
    with client(tmp_path) as app:
        response = app.post(
            "/operators/refresh",
            json={"sourceSlug": "luma-singapore"},
            headers={"X-HackRadar-Operator-Token": "offline-operator-token"},
        )
        job_id = response.json()["jobs"][0]["jobId"]
        result = app.get(
            f"/operators/jobs/{job_id}",
            headers={"X-HackRadar-Operator-Token": "offline-operator-token"},
        )
    assert response.status_code == 202
    assert result.json()["status"] == "completed"
    assert result.json()["result"]["rows"] == 1


def test_operator_can_refresh_wemakedevs_for_all_markets(tmp_path: Path, monkeypatch) -> None:
    studio_rows = [{
        "title": "Generic discovery title",
        "detail_url": "https://www.wemakedevs.org/hackathons/falkordb",
    }]

    async def studio_run(
        _service: RefreshService, _collector_id: str, _target_url: str
    ) -> DriftReport:
        return DriftReport(studio_rows, [], sorted(studio_rows[0]))

    async def enriched_rows(
        _service: WeMakeDevsService, discovered: list[dict[str, object]]
    ) -> list[dict[str, object]]:
        assert discovered == studio_rows
        return [{
            "title": "Graph Hacks: Building Next-Gen RAG",
            "detail_url": "https://www.wemakedevs.org/hackathons/falkordb",
            "organizer": "WeMakeDevs",
            "location": "Remote",
            "country": "GLOBAL",
            "start_date": "2026-08-31",
            "end_date": "2026-09-30",
            "registration_deadline": None,
            "prize_text": "$10,000 across three tracks",
            "prize_amount": 10000,
            "prize_currency": "USD",
            "themes": [],
            "eligibility": None,
            "participation_mode": "Online",
            "description": "Online hackathon listed by WeMakeDevs.",
        }]

    monkeypatch.setattr(RefreshService, "run", studio_run)
    monkeypatch.setattr(WeMakeDevsService, "enrich_discovery", enriched_rows)
    settings = Settings(
        database_url=f"sqlite:///{tmp_path / 'wemakedevs.db'}",
        operator_token="offline-operator-token",
        brightdata_api_key="offline-brightdata-key",
    )
    with TestClient(create_app(settings, Database(settings.database_url))) as app:
        response = app.post(
            "/operators/refresh",
            json={"sourceSlug": "wemakedevs-global"},
            headers={"X-HackRadar-Operator-Token": "offline-operator-token"},
        )
        job_id = response.json()["jobs"][0]["jobId"]
        result = app.get(
            f"/operators/jobs/{job_id}",
            headers={"X-HackRadar-Operator-Token": "offline-operator-token"},
        )
        feeds = {
            country: app.get("/hackathons", params={"country": country, "limit": 50}).json()["hackathons"]
            for country in ("US", "IN", "UK", "SG")
        }
    assert response.status_code == 202
    assert result.json()["status"] == "completed"
    assert result.json()["result"]["rows"] == 1
    assert result.json()["result"]["collectorId"] == "c_mt61hvcq1d8np500ya"
    assert result.json()["result"]["pipeline"] == "scraper-studio+public-card-enrichment"
    assert all(any(item["source"] == "WeMakeDevs" for item in feed) for feed in feeds.values())


def test_source_registry_discloses_live_health(tmp_path: Path) -> None:
    with client(tmp_path) as app:
        response = app.get("/sources")
    states = {item["slug"]: item["state"] for item in response.json()["sources"]}
    assert states == {
        "devpost-global": "ready",
        "hackathons-uk": "generation_failed",
        "luma-bengaluru": "unverified",
        "luma-london": "unverified",
        "luma-mumbai": "unverified",
        "luma-new-york": "unverified",
        "luma-san-francisco": "unverified",
        "luma-singapore": "unverified",
        "unstop-india": "degraded",
        "wemakedevs-global": "unverified",
    }


def test_public_target_rejects_private_and_government_hosts() -> None:
    for value in ("http://example.com", "https://127.0.0.1/events", "https://agency.gov/events"):
        try:
            public_target(value)
        except ValueError:
            continue
        raise AssertionError(f"unsafe target accepted: {value}")
