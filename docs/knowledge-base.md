# HackRadar knowledge base

Durable product, architecture, scraper, and deployment notes for the repository. Re-check live routes and provider jobs before repeating time-sensitive counts.

**Last reconciled:** 2026-08-23

**Repository:** <https://github.com/mohantyabhijit/hackathon-scrapper>

**Public product:** <https://abhijitmohanty.com/scrapper/>

## Product contract

HackRadar helps frequent hackathon participants decide what to build next. It presents a prize-ranked top ten for the United States, India, the United Kingdom, and Singapore. Country selection changes the eligible dataset and market visual treatment. Entries retain the original page, organizer, schedule, deadline, mode, categories, prize claim, effort estimate, summary, and verification date.

The six categories are AI, Web3, Web, Mobile, Climate, and Other. Effort is an editorial planning aid derived from the event schedule: Weekend, Focused, or Marathon. It is not a guarantee of the work required.

The organizer page remains authoritative. HackRadar does not organize events, take applications, guarantee prizes, or determine final eligibility.

## Data boundaries

- Signed-out public listing and event pages only.
- No login, account, application, private community, cart, checkout, paywall, personal-data, restricted, CAPTCHA-bypass, or government scraping.
- Preserve canonical source URLs and source verification dates.
- Never invent dates or prize values. Unknown values remain explicit and rank after disclosed cash pools.
- A provider job reaching `done` is not evidence of usable data. The exact target must return non-empty contract-valid rows.
- Failed and drifted runs preserve the last-known-good database rows.

## Architecture

```text
public event pages
  -> Bright Data Scraper Studio collectors
  -> Bright Data API trigger/dataset polling
  -> schema drift inspection
  -> Pydantic normalization and category/effort enrichment
  -> PostgreSQL last-known-good records
  -> FastAPI country/category query
  -> Next.js static application at /scrapper
  -> original event link
```

The frontend is a statically exported Next.js 16 application. Its interactive Three.js scene is client-only and non-essential to reading or operating the leaderboard. The frontend requests `/scrapper-api/hackathons`; if fewer than ten live rows are available for a market, it keeps the checked-in verified snapshot and labels the view accordingly.

The backend is FastAPI with SQLAlchemy. `hackathons` stores the normalized payload and sortable USD-equivalent prize. `scraper_sources` owns stable collector bindings, expected schema, state, and last-good schema/time. `studio_jobs` records asynchronous create, heal, approve, and refresh operations without storing credentials or raw provider bodies.

## Current collector registry

| Source | Slug | Country scope | Collector ID | Exact target | State on 2026-08-23 |
| --- | --- | --- | --- | --- | --- |
| Devpost | `devpost-global` | Global online / US anchor | `c_mt5n8l0w1kcr7uzxre` | public upcoming online listing | Same-ID healed twice; 9 flat rows, complete keys, 8 disclosed prizes, 3 rows with usable schedules |
| Unstop | `unstop-india` | India | `c_mt5n8mon1lgz9hhuoe` | public hackathon listing | Same-ID repair and exact-target verification in progress |
| Hackathons UK | `hackathons-uk` | United Kingdom | `c_mt5n8jd5y2gdnzt5p` | public events listing | Initial Studio generation failed before a runnable template existed; do not claim it as healed or ready |

The failed UK ID is retained as evidence. A replacement is allowed only because Studio did not create a runnable template to repair; document any replacement ID and validate it independently before changing the registry.

Never reuse SecondSpin collector `c_mt2nbsqd1akac96fiz`; it belongs to a vacuum-parts project and target.

## Normalized event contract

Collector rows use flat snake-case fields:

```text
title, detail_url, organizer, location, country,
start_date, end_date, registration_deadline,
prize_text, prize_amount, prize_currency,
themes, eligibility, participation_mode, description
```

The application model uses stable camel-case JSON with:

```text
id, title, organizer, source, sourceUrl,
eligibleCountries, venueCountry, mode,
startDate, endDate, deadline,
prizeUsd, prizeDisplay, categories,
effort, effortNote, summary, verifiedAt
```

`id` is the deduplication boundary. Source URLs are not unique because one public listing page can support multiple event records. Human-formatted Studio dates such as `Sep 1, 2026` are accepted, but missing schedules are not fabricated.

## Prompt-to-collector and self-healing

Authenticated operator routes:

- `POST /operators/sources` turns a public target plus operator goal into a bounded GPT-generated Studio creation prompt and invokes `bdata scraper create`.
- `POST /operators/sources/{slug}/heal` asks GPT for a narrow drift repair and invokes `bdata scraper heal` on the existing Collector ID.
- `POST /operators/sources/{slug}/approve` promotes a repaired Studio template.
- `POST /operators/refresh` triggers one or all runnable sources in the background.
- `GET /operators/jobs/{id}` reports sanitized job state.

Provider credentials are passed to subprocesses through their environment, never command arguments. Provider responses are sanitized before job errors are persisted. Creation/healing run as background jobs so a long Studio workflow cannot tie up the initiating HTTP request.

The refresh sequence is:

1. Trigger the allowlisted collector and exact target.
2. Poll the bounded dataset endpoint for at most six minutes.
3. Compare returned keys and populated required fields with `expected_schema`.
4. Normalize only rows with a public link and usable schedule.
5. If valid, transactionally upsert the rows and update last-good metadata.
6. If drifted, preserve existing rows and optionally generate a same-ID repair prompt.
7. Require a new exact-target run before treating the repaired collector as ready.

## Seed data and ranking

`data/hackathons.ts` is the typed frontend snapshot and `data/hackathons.json` is its backend seed equivalent. The records were researched from public event and organizer pages on 2026-08-23. They provide at least ten eligible entries for every supported country and preserve original URLs. Values are time-specific source claims and must be refreshed before a future submission or demo.

Ranking sorts disclosed `prizeUsd` descending and places unknown/non-cash prizes last. Currency conversion exists only to create a comparable discovery ranking; the card retains the source display value and does not claim a guaranteed payout.

## Secrets

| Secret | Local source | Production source |
| --- | --- | --- |
| Bright Data API key | macOS Keychain | root-readable service environment file |
| OpenAI API key | macOS Keychain service `OPENAI_API_KEY` | root-readable service environment file |
| Operator token | generated locally without display | root-readable service environment file |
| PostgreSQL URL | local environment | root-readable service environment file |

Never print secret values, raw authorization headers, production environment files, or database credentials. Verification should use service health, provider job status, and non-secret IDs.

## Deployment target

- Frontend: exported files under `/srv/hackradar/frontend/current`, served by Nginx at `/scrapper/`.
- Backend: Python virtual environment and application under `/srv/hackradar/backend`, bound to `127.0.0.1:8095` and proxied at `/scrapper-api/`.
- Database: dedicated PostgreSQL database/user on the existing VPS.
- Nginx: `abhijitmohanty.com` includes an isolated HackRadar snippet; validate with `nginx -t` before reload.

Production release order:

1. Run frontend and backend gates locally.
2. Build the Next static export locally.
3. Upload versioned frontend/backend release directories.
4. Sync the backend virtual environment and initialize the schema/seed through application startup.
5. Atomically switch `current` symlinks.
6. Validate and reload Nginx, then restart only HackRadar services.
7. Verify `/scrapper/`, static assets, `/scrapper-api/healthz`, and ten ranked API rows for all four countries.
8. Verify the browser country selector, category filter, original links, and mobile layout.

Do not call a successful push a deployment. The public routes and current service revisions must be checked separately.

## Quality gates

Frontend:

```bash
npm run lint
npm test
npm audit --omit=dev
```

Backend:

```bash
cd backend
uv sync --group dev
uv run ruff check .
uv run pytest -q
```

Release:

```bash
git diff --check
git status --short
```

Raw Studio output belongs under ignored `evidence/raw/`. Commit only sanitized counts, collector IDs, target URLs, schema results, and reproducible commands.

## Historical boundary

Earlier commits implement Raster, a GPU market-intelligence submission. Those commits remain in Git history as requested, but they are not the current HackRadar product contract. Current README, application routes, backend, source registry, deployment, and submission evidence must refer to HackRadar. Retained legacy files must not be imported by or presented as part of the current runtime.
