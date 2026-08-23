import asyncio
import json
import os


class CollectorCLIError(Exception):
    pass


class CollectorCLI:
    def __init__(self, api_key: str, timeout_seconds: int = 900) -> None:
        self._api_key = api_key
        self._timeout = min(max(timeout_seconds, 60), 1200)

    async def create(self, url: str, prompt: str, name: str) -> dict[str, object]:
        return await self._run("create", url, prompt, "--name", name, "--json")

    async def heal(self, collector_id: str, prompt: str, url: str) -> dict[str, object]:
        return await self._run("heal", collector_id, prompt, "--url", url, "--json")

    async def approve(self, collector_id: str) -> dict[str, object]:
        return await self._run("approve", collector_id, "--json")

    async def _run(self, *arguments: str) -> dict[str, object]:
        environment = {**os.environ, "BRIGHTDATA_API_KEY": self._api_key}
        process = await asyncio.create_subprocess_exec(
            "npx", "bdata", "scraper", *arguments,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            env=environment,
        )
        try:
            stdout, _stderr = await asyncio.wait_for(process.communicate(), timeout=self._timeout)
        except TimeoutError as error:
            process.kill()
            await process.wait()
            raise CollectorCLIError("Scraper Studio CLI timed out.") from error
        if process.returncode != 0:
            raise CollectorCLIError("Scraper Studio CLI operation failed.")
        try:
            payload = json.loads(stdout)
        except ValueError as error:
            raise CollectorCLIError("Scraper Studio CLI returned invalid JSON.") from error
        if not isinstance(payload, dict):
            raise CollectorCLIError("Scraper Studio CLI returned an invalid envelope.")
        return payload
