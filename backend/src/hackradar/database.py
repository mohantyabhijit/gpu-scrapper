from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from sqlalchemy import JSON, DateTime, String, Text, create_engine, select
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column

from hackradar.contracts import Hackathon


class Base(DeclarativeBase):
    pass


class HackathonRow(Base):
    __tablename__ = "hackathons"
    id: Mapped[str] = mapped_column(String(160), primary_key=True)
    payload: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    prize_usd: Mapped[float | None]
    # Listing pages can describe multiple events, so the canonical event id—not
    # the source URL—is the deduplication boundary.
    source_url: Mapped[str] = mapped_column(Text, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class SourceRow(Base):
    __tablename__ = "scraper_sources"
    slug: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    target_url: Mapped[str] = mapped_column(Text, nullable=False)
    collector_id: Mapped[str] = mapped_column(String(80), unique=True, nullable=False)
    country: Mapped[str] = mapped_column(String(2), nullable=False)
    state: Mapped[str] = mapped_column(String(32), nullable=False, default="ready")
    expected_schema: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    last_good_schema: Mapped[list[str] | None] = mapped_column(JSON)
    last_good_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class StudioJobRow(Base):
    __tablename__ = "studio_jobs"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    kind: Mapped[str] = mapped_column(String(32), nullable=False)
    source_slug: Mapped[str] = mapped_column(String(64), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    result: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    error: Mapped[str | None] = mapped_column(String(240))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


EXPECTED_FIELDS = [
    "title", "detail_url", "organizer", "location", "country", "start_date", "end_date",
    "registration_deadline", "prize_text", "prize_amount", "prize_currency", "themes",
    "eligibility", "participation_mode", "description",
]


class Database:
    def __init__(self, url: str) -> None:
        self.engine = create_engine(url, pool_pre_ping=True)

    def create(self) -> None:
        Base.metadata.create_all(self.engine)

    def seed_sources(self) -> None:
        sources = [
            SourceRow(slug="devpost-global", name="Devpost", target_url="https://devpost.com/hackathons?challenge_type[]=online&open_to[]=public&status[]=upcoming", collector_id="c_mt5n8l0w1kcr7uzxre", country="US", state="repairing", expected_schema=EXPECTED_FIELDS),
            SourceRow(slug="unstop-india", name="Unstop India", target_url="https://unstop.com/hackathons", collector_id="c_mt5n8mon1lgz9hhuoe", country="IN", state="repairing", expected_schema=EXPECTED_FIELDS),
            SourceRow(slug="hackathons-uk", name="Hackathons UK", target_url="https://www.hackathons.org.uk/events/", collector_id="c_mt5n8jd5y2gdnzt5p", country="UK", state="generation_failed", expected_schema=EXPECTED_FIELDS),
        ]
        with Session(self.engine) as session:
            for source in sources:
                if session.get(SourceRow, source.slug) is None:
                    session.add(source)
            session.commit()

    def seed_hackathons(self, path: Path) -> int:
        payloads = json.loads(path.read_text())
        with Session(self.engine) as session:
            for payload in payloads:
                item = Hackathon.model_validate(payload)
                dumped = item.model_dump(by_alias=True, mode="json")
                row = session.get(HackathonRow, item.id) or HackathonRow(id=item.id, payload=dumped, prize_usd=item.prize_usd, source_url=item.source_url, updated_at=datetime.now(UTC))
                row.payload, row.prize_usd, row.source_url, row.updated_at = dumped, item.prize_usd, item.source_url, datetime.now(UTC)
                session.add(row)
            session.commit()
        return len(payloads)

    def list_hackathons(self, country: str, category: str | None, limit: int) -> list[dict[str, Any]]:
        with Session(self.engine) as session:
            rows = session.scalars(select(HackathonRow).order_by(HackathonRow.prize_usd.desc().nullslast())).all()
        values = [row.payload for row in rows if country in row.payload.get("eligibleCountries", [])]
        if category:
            values = [value for value in values if category in value.get("categories", [])]
        return values[:limit]

    def upsert_hackathons(self, items: list[Hackathon]) -> int:
        with Session(self.engine) as session:
            for item in items:
                dumped = item.model_dump(by_alias=True, mode="json")
                row = session.get(HackathonRow, item.id) or HackathonRow(
                    id=item.id, payload=dumped, prize_usd=item.prize_usd,
                    source_url=item.source_url, updated_at=datetime.now(UTC),
                )
                row.payload, row.prize_usd, row.source_url = dumped, item.prize_usd, item.source_url
                row.updated_at = datetime.now(UTC)
                session.add(row)
            session.commit()
        return len(items)

    def get_source(self, slug: str) -> SourceRow | None:
        with Session(self.engine) as session:
            source = session.get(SourceRow, slug)
            if source:
                session.expunge(source)
            return source

    def list_sources(self) -> list[SourceRow]:
        with Session(self.engine) as session:
            values = list(session.scalars(select(SourceRow).order_by(SourceRow.slug)))
            for value in values:
                session.expunge(value)
            return values

    def put_job(self, job: StudioJobRow) -> None:
        with Session(self.engine) as session:
            session.merge(job)
            session.commit()

    def get_job(self, job_id: str) -> StudioJobRow | None:
        with Session(self.engine) as session:
            value = session.get(StudioJobRow, job_id)
            if value:
                session.expunge(value)
            return value

    def upsert_source(self, source: SourceRow) -> None:
        with Session(self.engine) as session:
            session.merge(source)
            session.commit()
