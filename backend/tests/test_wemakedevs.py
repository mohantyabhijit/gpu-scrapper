import json
from datetime import date

from hackradar.services.wemakedevs import parse_wemakedevs_hackathons


def page(cards: list[dict[str, object]]) -> str:
    payload = f'0:{{"cards":{json.dumps(cards)},"failed":false}}'
    argument = json.dumps([1, payload])
    return f"<html><body><script>self.__next_f.push({argument})</script></body></html>"


def test_wemakedevs_cards_are_normalized_and_past_events_are_dropped() -> None:
    html = page([
        {
            "id": "current",
            "title": "The Agent Harness Hackathon",
            "location": "Hybrid",
            "formats": ["online", "offline"],
            "prize": "$$10,000 in prizes",
            "href": "/hackathons/trueforge",
            "startDate": "2026-08-24T07:00:00Z",
            "endDate": "2026-08-30T19:00:00Z",
        },
        {
            "id": "external",
            "title": "The Rote Playoffs Hackathon",
            "location": "Remote",
            "formats": ["online"],
            "prize": "$$5,000 in prizes",
            "href": "https://luma.com/rotehack",
            "startDate": "2026-09-01T07:00:00Z",
            "endDate": "2026-09-06T19:00:00Z",
        },
        {
            "id": "past",
            "title": "Past Hackathon",
            "location": "Remote",
            "formats": ["online"],
            "prize": "$$15,000",
            "href": "/hackathons/past",
            "startDate": "2026-08-17T02:30:00Z",
            "endDate": "2026-08-23T18:29:00Z",
        },
    ])
    results = parse_wemakedevs_hackathons(html, today=date(2026, 8, 24))
    assert len(results) == 2
    assert results[0]["detail_url"] == "https://www.wemakedevs.org/hackathons/trueforge"
    assert results[0]["participation_mode"] == "Hybrid"
    assert results[0]["country"] == "GLOBAL"
    assert results[0]["prize_text"] == "$10,000 in prizes"
    assert results[0]["prize_amount"] == 10000
    assert results[0]["prize_currency"] == "USD"
    assert results[0]["themes"] == ["AI"]
    assert results[1]["detail_url"] == "https://luma.com/rotehack"


def test_wemakedevs_parser_rejects_non_allowlisted_listing_url() -> None:
    assert parse_wemakedevs_hackathons(
        page([]), requested_url="https://example.com/#hackathons", today=date(2026, 8, 24)
    ) == []
