from __future__ import annotations

import json
import re
from datetime import UTC, date, datetime
from html.parser import HTMLParser
from typing import Any
from urllib.parse import urljoin, urlparse

import httpx

WEMAKEDEVS_URL = "https://www.wemakedevs.org/#hackathons"
WEMAKEDEVS_HOSTS = {"wemakedevs.org", "www.wemakedevs.org"}
WEMAKEDEVS_COLLECTOR_ID = "c_mt61hvcq1d8np500ya"


class _ScriptParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self._capturing = False
        self._buffer: list[str] = []
        self.scripts: list[str] = []

    def handle_starttag(self, tag: str, _attrs: list[tuple[str, str | None]]) -> None:
        if tag == "script":
            self._capturing = True
            self._buffer = []

    def handle_data(self, data: str) -> None:
        if self._capturing:
            self._buffer.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag == "script" and self._capturing:
            self.scripts.append("".join(self._buffer))
            self._capturing = False


def _next_payloads(html: str) -> list[str]:
    parser = _ScriptParser()
    parser.feed(html)
    prefix = "self.__next_f.push("
    payloads: list[str] = []
    for script in parser.scripts:
        if not script.startswith(prefix):
            continue
        argument = script[len(prefix) :].rstrip("; ")
        if not argument.endswith(")"):
            continue
        try:
            value = json.loads(argument[:-1])
        except json.JSONDecodeError:
            continue
        if (
            isinstance(value, list)
            and len(value) > 1
            and isinstance(value[1], str)
        ):
            payloads.append(value[1])
    return payloads


def _card_values(html: str) -> list[dict[str, Any]]:
    marker = '"cards":'
    decoder = json.JSONDecoder()
    cards: dict[str, dict[str, Any]] = {}
    for payload in _next_payloads(html):
        offset = 0
        while (index := payload.find(marker, offset)) >= 0:
            start = index + len(marker)
            try:
                value, consumed = decoder.raw_decode(payload[start:])
            except json.JSONDecodeError:
                offset = start
                continue
            if isinstance(value, list):
                for card in value:
                    if isinstance(card, dict) and isinstance(card.get("id"), str):
                        cards[card["id"]] = card
            offset = start + consumed
    return list(cards.values())


def _event_date(value: object) -> date | None:
    if not isinstance(value, str):
        return None
    try:
        return datetime.fromisoformat(value).date()
    except ValueError:
        return None


def _prize(value: object) -> tuple[str | None, float | None, str | None]:
    if not isinstance(value, str) or not value.strip():
        return None, None, None
    text = re.sub(r"^\${2,}", "$", value.strip())
    match = re.search(r"\$\s*([\d,]+(?:\.\d+)?)", text)
    amount = float(match.group(1).replace(",", "")) if match else None
    return text, amount, "USD" if amount is not None else None


def _detail_url(value: object) -> str | None:
    if not isinstance(value, str) or not value.strip():
        return None
    url = urljoin("https://www.wemakedevs.org/", value.strip())
    parsed = urlparse(url)
    if parsed.scheme != "https" or not parsed.hostname:
        return None
    if parsed.hostname not in WEMAKEDEVS_HOSTS and parsed.hostname not in {"luma.com", "www.luma.com"}:
        return None
    return url


def _themes(title: str) -> list[str]:
    lowered = title.lower()
    return ["AI"] if re.search(r"\b(ai|agent|agents|rag|llm|machine learning)\b", lowered) else []


def parse_wemakedevs_hackathons(
    html: str, *, requested_url: str = WEMAKEDEVS_URL, today: date | None = None
) -> list[dict[str, object]]:
    requested = urlparse(requested_url)
    if requested.scheme != "https" or requested.hostname not in WEMAKEDEVS_HOSTS:
        return []
    current_date = today or datetime.now(UTC).date()
    results: list[dict[str, object]] = []
    for card in _card_values(html):
        title = card.get("title")
        start_date = _event_date(card.get("startDate"))
        end_date = _event_date(card.get("endDate"))
        detail_url = _detail_url(card.get("href"))
        if (
            not isinstance(title, str)
            or not title.strip()
            or not start_date
            or not end_date
            or end_date < current_date
            or not detail_url
        ):
            continue
        formats = {
            str(value).lower()
            for value in card.get("formats", [])
            if isinstance(value, str)
        }
        mode = "Hybrid" if {"online", "offline"} <= formats else "Online" if "online" in formats else "In person"
        location = card.get("location")
        prize_text, prize_amount, prize_currency = _prize(card.get("prize"))
        results.append({
            "title": title.strip(),
            "detail_url": detail_url,
            "organizer": "WeMakeDevs",
            "location": location.strip() if isinstance(location, str) and location.strip() else "See source",
            "country": "GLOBAL" if "online" in formats else "US",
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "registration_deadline": None,
            "prize_text": prize_text,
            "prize_amount": prize_amount,
            "prize_currency": prize_currency,
            "themes": _themes(title),
            "eligibility": None,
            "participation_mode": mode,
            "description": f"{mode} hackathon listed by WeMakeDevs.",
        })
    return results


class WeMakeDevsService:
    def __init__(self, client: httpx.AsyncClient) -> None:
        self._client = client

    async def run(self) -> list[dict[str, object]]:
        response = await self._client.get(
            WEMAKEDEVS_URL,
            headers={"User-Agent": "HackRadar/0.1 (+https://abhijitmohanty.com/scrapper/)"},
            follow_redirects=True,
        )
        response.raise_for_status()
        return parse_wemakedevs_hackathons(response.text)

    async def enrich_discovery(
        self, discovered_rows: list[dict[str, object]]
    ) -> list[dict[str, object]]:
        """Complete Studio-discovered rows from the same public listing payload.

        Scraper Studio remains the discovery boundary: a listing is emitted only
        when the collector returned its allow-listed detail URL. The deterministic
        card parser supplies fields that Studio may omit or render inconsistently.
        """
        discovered_urls = {
            url
            for row in discovered_rows
            if (url := _detail_url(row.get("detail_url") or row.get("product_page_url")))
        }
        if not discovered_urls:
            return []
        canonical_rows = await self.run()
        return [
            row for row in canonical_rows
            if row.get("detail_url") in discovered_urls
        ]
