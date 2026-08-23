import asyncio
from dataclasses import dataclass

from hackradar.clients.brightdata import BrightDataClient, BrightDataError


@dataclass(frozen=True)
class DriftReport:
    rows: list[dict[str, object]]
    missing_fields: list[str]
    schema: list[str]

    @property
    def valid(self) -> bool:
        return bool(self.rows) and not self.missing_fields


def inspect_rows(rows: list[dict[str, object]], expected_fields: list[str]) -> DriftReport:
    if not rows:
        return DriftReport([], expected_fields, [])
    schema = sorted({key for row in rows for key in row})
    missing = [field for field in expected_fields if not any(row.get(field) not in (None, "", []) for row in rows)]
    return DriftReport(rows, missing, schema)


class RefreshService:
    def __init__(self, client: BrightDataClient) -> None:
        self._client = client

    async def run(self, collector_id: str, target_url: str) -> DriftReport:
        response_id = await self._client.trigger(collector_id, target_url)
        for _attempt in range(72):
            payload = await self._client.dataset(response_id)
            if isinstance(payload, list):
                return DriftReport(payload, [], sorted({key for row in payload for key in row}))
            status = str(payload.get("status", "building"))
            if status.lower() in {"failed", "error"}:
                raise BrightDataError("Collector run failed.")
            await asyncio.sleep(5)
        raise BrightDataError("Collector run exceeded the six-minute polling window.")
