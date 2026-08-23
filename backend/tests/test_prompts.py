import asyncio
from types import SimpleNamespace

from hackradar.database import EXPECTED_FIELDS
from hackradar.services.prompts import PromptBuilder


class ResponsesStub:
    def __init__(self) -> None:
        self.arguments: dict[str, object] = {}

    async def create(self, **kwargs: object) -> object:
        self.arguments = kwargs
        return SimpleNamespace(output_text="flat Studio prompt" * 100)


class ClientStub:
    def __init__(self) -> None:
        self.responses = ResponsesStub()


def test_new_source_prompt_enumerates_the_runtime_schema() -> None:
    client = ClientStub()
    value = asyncio.run(
        PromptBuilder(client).for_new_source(
            "https://example.com/events", "Extract genuine upcoming build events."
        )
    )
    assert len(value) == 500
    instructions = str(client.responses.arguments["instructions"])
    assert all(field in instructions for field in EXPECTED_FIELDS)
    assert "ISO YYYY-MM-DD" in instructions
