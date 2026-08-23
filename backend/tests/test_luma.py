import json
from datetime import date

from hackradar.services.luma import parse_luma_event


def page(event: dict[str, object]) -> str:
    return (
        '<html><head><script data-cfasync="false" type="application/ld+json">'
        f"{json.dumps(event)}"
        "</script></head></html>"
    )


def test_luma_json_ld_is_normalized_without_people_or_street_address() -> None:
    html = page({
        "@type": "Event",
        "@id": "https://luma.com/test-hack",
        "url": "https://luma.com/test-hack",
        "name": "Agent Hack",
        "description": (
            "Build an agent at this hackathon. SGD 5,000 prize pool. "
            "Contact private@example.com or https://example.com/private."
        ),
        "startDate": "2026-10-02T09:00:00+08:00",
        "endDate": "2026-10-03T18:00:00+08:00",
        "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
        "organizer": {"@type": "Person", "name": "Private Person"},
        "location": {
            "@type": "Place",
            "name": "Private venue",
            "address": {
                "addressLocality": "Singapore",
                "addressCountry": "SG",
                "streetAddress": "Do not retain this",
            },
        },
    })
    result = parse_luma_event(
        html,
        requested_url="https://luma.com/test-hack",
        fallback_country="SG",
        today=date(2026, 8, 23),
    )
    assert result is not None
    assert result["title"] == "Agent Hack"
    assert result["organizer"] == "Luma event host"
    assert result["location"] == "Singapore"
    assert result["prize_amount"] == 5000
    assert result["prize_currency"] == "SGD"
    assert "Private Person" not in str(result)
    assert "Do not retain this" not in str(result)
    assert "private@example.com" not in str(result)
    assert "example.com/private" not in str(result)


def test_luma_parser_rejects_recommendations_and_past_events() -> None:
    requested = {
        "@type": "Event",
        "url": "https://luma.com/requested",
        "name": "Past Hack",
        "description": "Past event",
        "startDate": "2026-01-01",
        "endDate": "2026-01-02",
    }
    recommendation = {
        **requested,
        "url": "https://luma.com/recommendation",
        "name": "Unrelated Event",
        "startDate": "2026-10-01",
        "endDate": "2026-10-02",
    }
    html = page({"@context": "https://schema.org", "@graph": [requested, recommendation]})
    assert parse_luma_event(
        html,
        requested_url="https://luma.com/requested",
        fallback_country="US",
        today=date(2026, 8, 23),
    ) is None


def test_luma_parser_rejects_non_build_events() -> None:
    html = page({
        "@type": "Event",
        "url": "https://luma.com/dinner",
        "name": "Community Dinner",
        "description": "Meet neighbors over a meal.",
        "startDate": "2026-10-01",
        "endDate": "2026-10-01",
    })
    assert parse_luma_event(
        html,
        requested_url="https://luma.com/dinner",
        fallback_country="US",
        today=date(2026, 8, 23),
    ) is None
