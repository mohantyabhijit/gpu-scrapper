import re
from datetime import UTC, date, datetime
from typing import Literal
from urllib.parse import urlparse

from pydantic import BaseModel, ConfigDict, Field, field_validator

CountryCode = Literal["US", "IN", "UK", "SG"]
Category = Literal["AI", "Web3", "Web", "Mobile", "Climate", "Other"]
Effort = Literal["Weekend", "Focused", "Marathon"]


class Hackathon(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str
    title: str
    organizer: str
    source: str
    source_url: str = Field(alias="sourceUrl")
    eligible_countries: list[CountryCode] = Field(alias="eligibleCountries")
    venue_country: CountryCode | Literal["GLOBAL"] = Field(alias="venueCountry")
    mode: Literal["Online", "In person", "Hybrid"]
    start_date: date = Field(alias="startDate")
    end_date: date = Field(alias="endDate")
    deadline: date
    prize_usd: float | None = Field(alias="prizeUsd")
    prize_display: str = Field(alias="prizeDisplay")
    categories: list[Category]
    effort: Effort
    effort_note: str = Field(alias="effortNote")
    summary: str
    verified_at: date = Field(alias="verifiedAt")

    @field_validator("source_url")
    @classmethod
    def public_https_source(cls, value: str) -> str:
        parsed = urlparse(value)
        if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password:
            raise ValueError("sourceUrl must be a public HTTPS URL")
        return value


class SourceCreate(BaseModel):
    slug: str = Field(pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$", max_length=64)
    name: str = Field(min_length=2, max_length=100)
    target_url: str = Field(alias="targetUrl", max_length=2048)
    country: CountryCode
    goal: str = Field(min_length=20, max_length=500)


class HealRequest(BaseModel):
    observed_problem: str = Field(alias="observedProblem", min_length=20, max_length=1000)


class RefreshRequest(BaseModel):
    source_slug: str | None = Field(default=None, alias="sourceSlug", pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


def normalize_collector_row(
    raw: dict[str, object], *, source_name: str, source_country: CountryCode
) -> Hackathon | None:
    def text(*keys: str) -> str:
        for key in keys:
            value = raw.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
        return ""

    def parsed_date(*keys: str) -> date | None:
        value = text(*keys)
        if not value:
            return None
        candidates = (value[:10], value, re.sub(r"(\d{1,2}) (\w+),", r"\1 \2", value))
        for candidate in candidates:
            for pattern in (None, "%b %d, %Y", "%B %d, %Y", "%d %B %Y", "%d %b %Y"):
                try:
                    return (
                        date.fromisoformat(candidate)
                        if pattern is None
                        else datetime.strptime(candidate, pattern).replace(tzinfo=UTC).date()
                    )
                except ValueError:
                    continue
        return None

    title = text("title", "name")
    source_url = text("detail_url", "source_url", "product_page_url", "url")
    start, end = parsed_date("start_date"), parsed_date("end_date")
    deadline = parsed_date("registration_deadline", "deadline") or end
    if not title or not source_url or not start or not end or not deadline:
        return None
    mode_text = text("participation_mode", "mode", "location").lower()
    mode: Literal["Online", "In person", "Hybrid"] = (
        "Hybrid" if "hybrid" in mode_text else "Online" if "online" in mode_text else "In person"
    )
    description = text("description", "summary")
    themes = raw.get("themes") if isinstance(raw.get("themes"), list) else []
    category_text = f"{title} {description} {' '.join(str(value) for value in themes)}".lower()
    categories: list[Category] = []
    for category, tokens in {
        "AI": ("ai", "machine learning", "agent", "computer vision"),
        "Web3": ("web3", "blockchain", "crypto"),
        "Web": ("web", "developer", "software"),
        "Mobile": ("mobile", "android", "ios", "app"),
        "Climate": ("climate", "sustain", "environment"),
    }.items():
        if any(token in category_text for token in tokens):
            categories.append(category)  # type: ignore[arg-type]
    if not categories:
        categories = ["Other"]
    prize_amount = raw.get("prize_amount")
    if isinstance(prize_amount, str):
        normalized = re.sub(r"[^0-9.]", "", prize_amount)
        prize_amount = float(normalized) if normalized else None
    if not isinstance(prize_amount, (int, float)):
        prize_amount = None
    currency = text("prize_currency").upper()
    usd_rates = {"USD": 1.0, "GBP": 1.35, "EUR": 1.175, "INR": 0.01196, "SGD": 0.777}
    prize_usd = float(prize_amount) * usd_rates[currency] if prize_amount is not None and currency in usd_rates else None
    duration = max((end - start).days + 1, 1)
    effort: Effort = "Weekend" if duration <= 4 else "Focused" if duration <= 35 else "Marathon"
    slug = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")[:120]
    return Hackathon.model_validate({
        "id": f"{source_name.lower().replace(' ', '-')}-{slug}",
        "title": title,
        "organizer": text("organizer") or source_name,
        "source": source_name,
        "sourceUrl": source_url,
        "eligibleCountries": ["US", "IN", "UK", "SG"] if mode == "Online" and source_name == "Devpost" else [source_country],
        "venueCountry": "GLOBAL" if mode == "Online" else source_country,
        "mode": mode,
        "startDate": start.isoformat(),
        "endDate": end.isoformat(),
        "deadline": deadline.isoformat(),
        "prizeUsd": prize_usd,
        "prizeDisplay": text("prize_text") or "Prize details at source",
        "categories": categories,
        "effort": effort,
        "effortNote": f"{duration}-day source schedule",
        "summary": description[:280] or "See the original page for the complete challenge brief.",
        "verifiedAt": datetime.now(UTC).date().isoformat(),
    })
