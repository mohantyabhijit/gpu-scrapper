from typing import Any

import httpx


class BrightDataError(Exception):
    """A provider operation failed without exposing its response body."""


class BrightDataClient:
    base_url = "https://api.brightdata.com/dca"

    def __init__(self, api_key: str, client: httpx.AsyncClient) -> None:
        self._api_key = api_key
        self._client = client

    async def trigger(self, collector_id: str, target_url: str) -> str:
        response = await self._client.post(
            f"{self.base_url}/trigger",
            params={"collector": collector_id, "queue_next": "1", "deadline": "5m"},
            headers=self._headers(),
            json=[{"url": target_url}],
        )
        payload = self._json(response)
        response_id = payload.get("collection_id") if isinstance(payload, dict) else None
        if not isinstance(response_id, str) or len(response_id) > 120:
            raise BrightDataError("Collector did not return a valid response ID.")
        return response_id

    async def dataset(self, response_id: str) -> list[dict[str, object]] | dict[str, object]:
        response = await self._client.get(
            f"{self.base_url}/dataset", params={"id": response_id}, headers=self._headers()
        )
        payload = self._json(response)
        if isinstance(payload, list):
            return [row for row in payload if isinstance(row, dict)]
        return payload if isinstance(payload, dict) else {}

    def _headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self._api_key}", "Content-Type": "application/json"}

    @staticmethod
    def _json(response: httpx.Response) -> Any:
        if response.is_error:
            raise BrightDataError(f"Bright Data returned HTTP {response.status_code}.")
        try:
            return response.json()
        except ValueError as error:
            raise BrightDataError("Bright Data returned invalid JSON.") from error
