# HackRadar

HackRadar is a prize-ranked hackathon discovery desk for people who build often. It turns fragmented public event listings into a deduplicated worldwide top ten plus focused views for the United States, India, the United Kingdom, and Singapore, with categories, original source links, prize values, deadlines, and a practical effort estimate.

**Public app:** <https://abhijitmohanty.com/scrapper/>

**Repository:** <https://github.com/mohantyabhijit/hackathon-scrapper>

## What makes it useful

- A market selector switches between worldwide discovery and country-aware eligibility views.
- Each country gets a prize-ranked top ten rather than an endless directory.
- Country views show an estimated local-currency value alongside canonical USD; the original source prize claim remains visible in the build brief.
- AI, Web3, Web, Mobile, Climate, and Other filters make the list actionable.
- Every card links to the original event and exposes dates, eligibility, prize, mode, and estimated build effort.
- A playful Three.js radar makes exploration tactile without blocking the content or accessibility path.
- Verified seed data keeps the product useful when a source is degraded; live collector rows replace matching records after validation.

HackRadar is a discovery product, not an organizer or application portal. Source pages remain authoritative for eligibility, dates, rules, and prizes.

## Scraper Studio workflow

The Python service treats Bright Data Scraper Studio as an operational subsystem:

```text
public event listing
  -> allowlisted Scraper Studio collector
  -> asynchronous Bright Data trigger and dataset polling
  -> schema-drift inspection
  -> HackRadar normalization
  -> PostgreSQL last-known-good upsert
  -> FastAPI country/category feed
  -> Next.js ranking UI
```

Collector creation and recovery are prompt-driven. An authenticated operator can ask the backend to create a collector for a new public source. GPT converts that goal into a bounded Studio extraction contract, while the Bright Data CLI creates the collector. On schema drift, the service describes the missing fields and heals the same Collector ID; a repaired template is promoted only after a non-empty contract-valid rerun. Failed runs never erase the last-known-good dataset.

Current source bindings and their verified state are recorded in [the knowledge base](docs/knowledge-base.md). Raw provider output, credentials, and authorization headers are intentionally excluded from Git.

## Stack

- Next.js 16, React 19, TypeScript, and Three.js
- FastAPI, Pydantic, SQLAlchemy, and PostgreSQL
- Bright Data Scraper Studio, MCP search/scrape tools, API, and CLI
- OpenAI for bounded prompt generation and schema-drift repair instructions

## Local development

Requirements: Node.js 22+, Python 3.12+, and `uv`.

```bash
npm ci
npm run dev
```

The app is served under `/scrapper` to match production.

```bash
cd backend
uv sync --group dev
uv run uvicorn hackradar.app:app --reload --port 8000
```

The frontend reads `/scrapper-api/hackathons?country=WORLD|US|IN|UK|SG` in production and falls back to the checked-in verified snapshot if the API is unavailable. FX values are presentation estimates derived from the canonical USD amount; they never change ranking or source evidence.

## Configuration

Copy names only from `backend/.env.example`; supply values through Keychain or the deployment secret store.

- `DATABASE_URL`
- `BRIGHTDATA_API_KEY`
- `OPENAI_API_KEY`
- `OPERATOR_TOKEN`
- `AUTO_HEAL_ENABLED`
- `ALLOWED_ORIGINS`

Never commit API keys or paste them into logs, screenshots, issues, or submission material.

## Quality gates

```bash
npm run lint
npm test
npm audit --omit=dev

cd backend
uv run ruff check .
uv run pytest -q
```

## Data boundary

HackRadar reads signed-out public catalog and event pages only. It does not scrape logins, accounts, applications, private communities, carts, paywalled pages, personal data, restricted pages, or government systems. The original source URL and verification date remain part of every record.

## Submission

Judge-facing architecture, demo steps, collector evidence, and honest completion gates live under `docs/`. A Studio job reaching `done` is not presented as success unless its exact target produces non-empty, schema-valid output and the public application renders the resulting model.
