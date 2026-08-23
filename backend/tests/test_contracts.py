from hackradar.contracts import normalize_collector_row


def test_normalizes_a_complete_studio_row() -> None:
    item = normalize_collector_row(
        {
            "title": "Agent Weekend",
            "detail_url": "https://example.com/hackathons/agent-weekend",
            "organizer": "Builders Club",
            "start_date": "2026-10-03",
            "end_date": "2026-10-04",
            "registration_deadline": "2026-09-28",
            "prize_text": "$5,000 cash",
            "prize_amount": 5000,
            "prize_currency": "USD",
            "themes": ["Machine Learning/AI", "Web"],
            "participation_mode": "Online",
            "description": "Build an AI agent that removes repetitive work.",
        },
        source_name="Devpost",
        source_country="US",
    )
    assert item is not None
    assert item.prize_usd == 5000
    assert item.effort == "Weekend"
    assert item.eligible_countries == ["US", "IN", "UK", "SG"]
    assert item.categories == ["AI", "Web"]


def test_rejects_a_drifted_row_without_dates() -> None:
    assert normalize_collector_row(
        {"title": "Broken", "detail_url": "https://example.com/broken"},
        source_name="Devpost", source_country="US",
    ) is None
