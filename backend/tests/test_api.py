from pathlib import Path

from fastapi.testclient import TestClient

from hackradar.app import create_app, public_target
from hackradar.config import Settings
from hackradar.contracts import Hackathon
from hackradar.database import Database


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


def test_source_registry_discloses_live_health(tmp_path: Path) -> None:
    with client(tmp_path) as app:
        response = app.get("/sources")
    states = {item["slug"]: item["state"] for item in response.json()["sources"]}
    assert states == {
        "devpost-global": "ready",
        "hackathons-uk": "generation_failed",
        "unstop-india": "degraded",
    }


def test_public_target_rejects_private_and_government_hosts() -> None:
    for value in ("http://example.com", "https://127.0.0.1/events", "https://agency.gov/events"):
        try:
            public_target(value)
        except ValueError:
            continue
        raise AssertionError(f"unsafe target accepted: {value}")
