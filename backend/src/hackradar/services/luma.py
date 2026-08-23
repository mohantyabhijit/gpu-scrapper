from __future__ import annotations

import asyncio
import json
import re
from datetime import UTC, date, datetime
from html.parser import HTMLParser
from typing import Any
from urllib.parse import urlparse

import httpx

LUMA_TARGETS: dict[str, tuple[str, ...]] = {
    "luma-san-francisco": (
        "https://luma.com/beta-79jb",
        "https://luma.com/ai-agents-hardware-mcp-hackathon-vibe-co",
        "https://luma.com/truefoundry-agent-harness-hackathon-sep19-2026",
        "https://luma.com/25qlts61",
        "https://luma.com/8cb5mgws",
    ),
    "luma-new-york": (
        "https://luma.com/0pmeuk83",
        "https://luma.com/def-acc-hack-nyc",
        "https://luma.com/xrpl-hackathon-nyc",
        "https://luma.com/nihrwljs",
        "https://luma.com/arya-health-hack",
    ),
    "luma-london": (
        "https://luma.com/edth-2026-london",
        "https://luma.com/vnia1awh",
        "https://luma.com/bgovi683",
        "https://luma.com/as4ojb29",
        "https://luma.com/ol25ta77",
    ),
    "luma-bengaluru": (
        "https://luma.com/2ci4ttpy",
        "https://luma.com/openhousehack-india",
        "https://luma.com/5z9zp0u0",
        "https://luma.com/f20lkkce",
        "https://luma.com/ohxjtfos",
    ),
    "luma-mumbai": (
        "https://luma.com/ay8ehg6p",
        "https://luma.com/b37r69rs",
        "https://luma.com/fhakman4",
    ),
    "luma-singapore": (
        "https://luma.com/qc27yx6b",
        "https://luma.com/sdth-2026",
        "https://luma.com/4i4cc4xt",
        "https://luma.com/an9krh0p",
        "https://luma.com/7cwmg4he",
        "https://luma.com/i6aidaj1",
    ),
}

BUILD_EVENT_TERMS = (
    "hackathon",
    "hack day",
    "hack fest",
    "build sprint",
    "build session",
    "builder arena",
    "coding sprint",
    "ai sprint",
    "hacker house",
    "vibecodathon",
    "ctf",
)


class _StructuredDataParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self._capturing = False
        self._buffer: list[str] = []
        self.values: list[Any] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = dict(attrs)
        if tag == "script" and values.get("type") == "application/ld+json":
            self._capturing = True
            self._buffer = []

    def handle_data(self, data: str) -> None:
        if self._capturing:
            self._buffer.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag != "script" or not self._capturing:
            return
        self._capturing = False
        try:
            self.values.append(json.loads("".join(self._buffer)))
        except json.JSONDecodeError:
            pass


def _events(value: Any) -> list[dict[str, Any]]:
    if isinstance(value, list):
        return [event for item in value for event in _events(item)]
    if not isinstance(value, dict):
        return []
    found = [value] if value.get("@type") == "Event" else []
    return found + _events(value.get("@graph", []))


def _iso_date(value: object) -> date | None:
    if not isinstance(value, str):
        return None
    try:
        return datetime.fromisoformat(value).date()
    except ValueError:
        return None


def _organizer(value: object) -> str:
    values = value if isinstance(value, list) else [value]
    organizations = [
        item.get("name")
        for item in values
        if isinstance(item, dict) and item.get("@type") == "Organization"
    ]
    names = [name.strip() for name in organizations if isinstance(name, str) and name.strip()]
    return ", ".join(names) or "Luma event host"


def _location(value: object, fallback_country: str) -> tuple[str, str]:
    if not isinstance(value, dict):
        return "Location shown at source", fallback_country
    address = value.get("address") if isinstance(value.get("address"), dict) else {}
    locality = address.get("addressLocality")
    name = value.get("name")
    country = address.get("addressCountry")
    public_location = locality if isinstance(locality, str) and locality.strip() else name
    return (
        str(public_location).strip() if public_location else "Location shown at source",
        str(country).upper() if isinstance(country, str) and len(country) == 2 else fallback_country,
    )


def _mode(value: object) -> str:
    text = str(value).lower()
    if "mixed" in text:
        return "Hybrid"
    if "online" in text:
        return "Online"
    return "In person"


def _prize(description: str) -> tuple[str | None, float | None, str | None]:
    patterns = (
        (r"(?:US\$|USD)\s*([\d,.]+)", "USD"),
        (r"(?:S\$|SGD)\s*([\d,.]+)", "SGD"),
        (r"(?:£|GBP)\s*([\d,.]+)", "GBP"),
        (r"(?:₹|INR)\s*([\d,.]+)", "INR"),
    )
    for pattern, currency in patterns:
        if match := re.search(pattern, description, re.IGNORECASE):
            amount = float(match.group(1).replace(",", ""))
            return match.group(0), amount, currency
    return None, None, None


def _public_description(value: str) -> str:
    value = re.sub(r"https?://\S+", "", value)
    value = re.sub(r"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}", "", value)
    return re.sub(r"\s+", " ", value).strip()


def parse_luma_event(
    html: str, *, requested_url: str, fallback_country: str, today: date | None = None
) -> dict[str, object] | None:
    requested = urlparse(requested_url)
    if requested.scheme != "https" or requested.hostname not in {"luma.com", "www.luma.com"}:
        return None
    parser = _StructuredDataParser()
    parser.feed(html)
    candidates = [event for value in parser.values for event in _events(value)]
    event = None
    for item in candidates:
        canonical = urlparse(str(item.get("url") or item.get("@id") or ""))
        if canonical.hostname in {"luma.com", "www.luma.com"} and canonical.path == requested.path:
            event = item
            break
    if not event:
        return None
    title = event.get("name")
    description = event.get("description")
    start_date, end_date = _iso_date(event.get("startDate")), _iso_date(event.get("endDate"))
    if not isinstance(title, str) or not isinstance(description, str) or not start_date or not end_date:
        return None
    if not any(term in f"{title} {description}".lower() for term in BUILD_EVENT_TERMS):
        return None
    if end_date < (today or datetime.now(UTC).date()):
        return None
    location, country = _location(event.get("location"), fallback_country)
    prize_text, prize_amount, prize_currency = _prize(description)
    return {
        "title": title.strip(),
        "detail_url": requested_url.split("?", 1)[0],
        "organizer": _organizer(event.get("organizer")),
        "location": location,
        "country": country,
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "registration_deadline": None,
        "prize_text": prize_text,
        "prize_amount": prize_amount,
        "prize_currency": prize_currency,
        "themes": [],
        "eligibility": None,
        "participation_mode": _mode(event.get("eventAttendanceMode")),
        "description": _public_description(description),
    }


class LumaService:
    def __init__(self, client: httpx.AsyncClient) -> None:
        self._client = client

    @staticmethod
    def target_count(source_slug: str) -> int:
        return len(LUMA_TARGETS.get(source_slug, ()))

    async def run(self, source_slug: str, country: str) -> list[dict[str, object]]:
        targets = LUMA_TARGETS.get(source_slug, ())
        semaphore = asyncio.Semaphore(3)

        async def fetch(url: str) -> dict[str, object] | None:
            async with semaphore:
                response = await self._client.get(
                    url,
                    headers={"User-Agent": "HackRadar/0.1 (+https://abhijitmohanty.com/scrapper/)"},
                    follow_redirects=True,
                )
                response.raise_for_status()
            return parse_luma_event(response.text, requested_url=url, fallback_country=country)

        values = await asyncio.gather(*(fetch(url) for url in targets), return_exceptions=True)
        return [value for value in values if isinstance(value, dict)]
