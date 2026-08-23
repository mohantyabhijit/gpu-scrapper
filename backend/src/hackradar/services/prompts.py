import json
from typing import Protocol

from hackradar.database import EXPECTED_FIELDS


class Responses(Protocol):
    async def create(self, **kwargs: object) -> object: ...


class OpenAIClient(Protocol):
    responses: Responses


class PromptBuilder:
    def __init__(self, client: OpenAIClient, model: str = "gpt-5.5") -> None:
        self._client = client
        self._model = model

    async def for_new_source(self, target_url: str, goal: str) -> str:
        fields = ", ".join(EXPECTED_FIELDS)
        return await self._ask(
            "Write one concise Bright Data Scraper Studio creation prompt. Require one flat record per event "
            f"and exactly these field names: {fields}. Dates must be ISO YYYY-MM-DD and unavailable values "
            "must be null. Do not request private, login, personal, or restricted data.",
            f"Target: {target_url}. Operator goal: {goal}",
            max_length=500,
        )

    async def for_drift(self, collector_id: str, missing: list[str], rows: list[dict[str, object]]) -> str:
        sample = json.dumps(rows[:2], ensure_ascii=True, separators=(",", ":"))[:4000]
        return await self._ask(
            "Write one narrow repair instruction for an existing Scraper Studio collector. Preserve its ID and "
            "flat output contract. Never invent missing values.",
            f"Collector: {collector_id}. Missing or drifted fields: {', '.join(missing)}. Sample: {sample}",
            max_length=1000,
        )

    async def _ask(self, instructions: str, input_text: str, *, max_length: int) -> str:
        response = await self._client.responses.create(
            model=self._model, store=False, instructions=instructions, input=input_text
        )
        value = str(getattr(response, "output_text", "")).strip()
        if not value:
            raise ValueError("OpenAI did not return a scraper prompt.")
        return value[:max_length]
