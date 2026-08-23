# Operations

## Local gates

```bash
npm ci && npm run lint && npm test && npm audit --omit=dev
cd backend && uv sync --group dev --locked && uv run ruff check . && uv run pytest -q
```

## Studio

Run a registered collector with `bdata scraper run <collector-id> <exact-target> --pretty`. When output drifts, describe the observed field failure and run `bdata scraper heal <same-id> "<specific repair>" --url <exact-target>`. Approve/save only after reviewing the preview, then rerun the exact target and validate normalized row count.

For a new source, use the authenticated `POST /operators/sources` route. It validates public HTTPS boundaries, obtains the Keychain/deployment-backed OpenAI prompt, and creates a named collector through the CLI. Never accept a caller-supplied Collector ID for an existing source.

## Production

Frontend releases live under `/srv/hackradar/frontend/releases`; backend releases live under `/srv/hackradar/backend/releases`. `current` symlinks are changed atomically. Restart only `hackradar-api.service`; test Nginx before reload.

Verify health, four country counts, assets, systemd state, database row count, browser selector/filter behavior, and console errors. Roll back by repointing each `current` symlink to the previous explicit release and restarting only HackRadar.
