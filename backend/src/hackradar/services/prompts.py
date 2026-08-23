import json
from typing import Protocol


class Responses(Protocol):
    async def create(self, **kwargs: object) -> object: ...


class OpenAIClient(Protocol):
    responses: Responses


class PromptBuilder:
    def __init__(self, client: OpenAIClient, model: str = "gpt-5.5") -> None:
        self._client = client
        self._model = model

    async def for_new_source(self, target_url: str, goal: str) -> str:
        return await self._ask(
            "Write one concise Bright Data Scraper Studio creation prompt. Require flat records and the exact "
            "HackRadar fields. Do not request private, login, personal, or restricted data.",
            f"Target: {target_url}. Operator goal: {goal}",
        )

    async def for_drift(self, collector_id: str, missing: list[str], rows: list[dict[str, object]]) -> str:
        sample = json.dumps(rows[:2], ensure_ascii=True, separators=(",", ":"))[:4000]
        return await self._ask(
            "Write one narrow repair instruction for an existing Scraper Studio collector. Preserve its ID and "
            "flat output contract. Never invent missing values.",
            f"Collector: {collector_id}. Missing or drifted fields: {', '.join(missing)}. Sample: {sample}",
        )

    async def _ask(self, instructions: str, input_text: str) -> str:
        response = await self._client.responses.create(
            model=self._model, store=False, instructions=instructions, input=input_text
        )
        value = str(getattr(response, "output_text", "")).strip()
        if not value:
            raise ValueError("OpenAI did not return a scraper prompt.")
        return value[:1000]
