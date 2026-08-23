# HackRadar knowledge base

Durable product, architecture, scraper, and deployment notes for the repository. Re-check live routes and provider jobs before repeating time-sensitive counts.

**Last reconciled:** 2026-08-24

**Repository:** <https://github.com/mohantyabhijit/hackathon-scrapper>

**Public product:** <https://abhijitmohanty.com/hackathons/>

## Product contract

HackRadar helps frequent hackathon participants decide what to build next. It presents a prize-ranked top ten for the United States, India, the United Kingdom, and Singapore. Country selection changes the eligible dataset and market visual treatment. Each ranking row opens a keyboard-accessible detail modal with the organizer, schedule, registration deadline, mode, eligible markets, categories, source prize claim, effort estimate, verification date, and a new-tab link to the original page.

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
  -> Bright Data Scraper Studio collectors -> Bright Data API trigger/dataset polling
  -> allowlisted Luma pages -> bounded canonical JSON-LD adapter
  -> allowlisted WeMakeDevs listing -> bounded Next.js card adapter
  -> contract inspection
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
| Unstop | `unstop-india` | India | `c_mt5n8mon1lgz9hhuoe` | public hackathon listing | Original remains runnable with 18 linked rows; broader same-ID repair failed after Studio validation, so prize/schedule fields remain degraded |
| Hackathons UK | `hackathons-uk` | United Kingdom | `c_mt5n8jd5y2gdnzt5p` | public events listing | Initial Studio generation failed before a runnable template existed; do not claim it as healed or ready |
| Luma | `luma-san-francisco`, `luma-new-york` | United States | deterministic JSON-LD adapter | Exa-discovered public pages in San Francisco and New York | Production refresh completed with 3 current rows; both bindings remain honestly `degraded` because some reviewed targets did not normalize |
| Luma | `luma-london` | United Kingdom | deterministic JSON-LD adapter | Exa-discovered public pages in London | Production refresh completed with 2 current rows; binding remains `degraded` |
| Luma | `luma-bengaluru`, `luma-mumbai` | India | deterministic JSON-LD adapter | Exa-discovered public pages in Bengaluru and Mumbai | Production refresh completed with 5 current rows; both bindings remain `degraded` |
| Luma | `luma-singapore` | Singapore | deterministic JSON-LD adapter | Exa-discovered public pages in Singapore | Production refresh completed with 1 current row; binding remains `degraded` |
| WeMakeDevs | `wemakedevs-global` | Global online / US anchor | deterministic Next.js card adapter | `https://www.wemakedevs.org/#hackathons` | Local exact-target validation normalized 4 public current/ongoing cards on 2026-08-24; production refresh pending |

The failed UK ID is retained as evidence. A replacement is allowed only because Studio did not create a runnable template to repair; document any replacement ID and validate it independently before changing the registry.

The GPT-authored replacement attempt created half-built collector `c_mt5pvcq9238pirddsq`, then failed during Studio intent analysis before a runnable template existed. It is evidence that the secured prompt-to-create path reached Studio, not a production source. Do not create a third UK collector until the two provider failures are inspected.

### Luma fallback workflow

Exa MCP discovered public Luma event URLs for San Francisco, New York, London, Bengaluru, Mumbai, and Singapore. Two Studio attempts were validated honestly: city collector `c_mt5ylasf26gxfk0wx6` never produced a template, while detail collector `c_mt5z2whq2q1we2xpeh` returned an empty exact-target run. Its heal selected an unrelated recommended event, so the proposed repair was rejected.

Luma therefore uses a bounded deterministic fallback rather than a false-ready Studio binding. The Python adapter accepts only allowlisted `https://luma.com/` URLs, selects the JSON-LD `Event` whose canonical path matches the requested URL, ignores recommendations, drops past or incomplete events, retains city-level location only, and excludes people, attendee lists, profiles, emails, street addresses, hidden venues, wallet data, and registration forms. Optional prizes are parsed only when an explicit currency marker is present. Missing values stay unknown.

The six source bindings are `luma-san-francisco`, `luma-new-york`, `luma-london`, `luma-bengaluru`, `luma-mumbai`, and `luma-singapore`. On 2026-08-24, authenticated production refreshes normalized 11 current events across all six bindings: 3 US, 2 UK, 5 India, and 1 Singapore. A refresh with at least one valid event completes and preserves the usable rows, but its source remains `degraded` when fewer events normalize than the reviewed target count. Treat these counts as time-specific.

Never reuse SecondSpin collector `c_mt2nbsqd1akac96fiz`; it belongs to a vacuum-parts project and target.

### WeMakeDevs workflow

WeMakeDevs uses its own `custom:wemakedevs:global` binding and does not share the Luma adapter or any Bright Data Collector ID. The Python adapter requests only the public listing, decodes the `cards` array embedded in the Next.js flight payload, and accepts only HTTPS detail links on WeMakeDevs or Luma. It requires a title and complete start/end dates, excludes expired or incomplete cards, normalizes the listing's doubled dollar-prefix display, and converts only explicitly disclosed USD amounts. It does not retain images, social links, email addresses, profiles, registration data, or unrelated page content.

On 2026-08-24, local exact-target validation returned four current/ongoing rows: The Agent Harness Hackathon, The Rote Playoffs Hackathon, Graph Hacks: Building Next-Gen RAG, and Into the Scrape-Verse. Treat that count as time-specific. Online and hybrid cards carry explicit `GLOBAL` eligibility through normalization so they appear in US, India, UK, and Singapore views. Sanitized source evidence lives at `scrapper-run-results/wemakedevs/01-listing-results.json`.

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
| OpenAI API key | macOS Keychain service `OPENAI_API_KEY` | root-readable service environment file as `OPENAI_API_KEY` |
| Operator token | generated locally without display | root-readable service environment file |
| PostgreSQL URL | local environment | root-readable service environment file |

Never print secret values, raw authorization headers, production environment files, or database credentials. Verification should use service health, provider job status, and non-secret IDs.

On 2026-08-23, a requested rotation to the local `scrapper-ai-key` entry was deployed and fingerprint-verified, but OpenAI rejected that credential with HTTP 401. Production was immediately restored from the root-only backup; the restored credential returned HTTP 200 from OpenAI and the public API health check passed. Do not retry `scrapper-ai-key` until its value has been replaced with a valid OpenAI project key.

## Deployment target

- Frontend: exported files under `/srv/hackradar/frontend/current`, served by Nginx at the judge-facing `/hackathons/` route; `/scrapper/` remains a compatibility route for existing assets and evidence links.
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
7. Verify `/hackathons/`, compatibility route `/scrapper/`, static assets, `/scrapper-api/healthz`, ten ranked worldwide rows, and ten ranked API rows for all four countries.
8. Verify the browser market selector, category filter, detail modal (including Escape, backdrop, and close-button dismissal), focus restoration, original links, dual-currency display, and mobile layout.

### Worldwide and currency presentation

- `WORLD` is a read-only virtual market: it returns every indexed event once, prize-ranked by canonical `prizeUsd`, without rewriting eligibility.
- `US`, `IN`, `UK`, and `SG` remain eligibility-aware views.
- Country cards show estimated USD-to-local presentation values using the checked-in normalization reference rates: USD 1, INR 83.61, GBP 0.7407, and SGD 1.287 per USD.
- FX is display-only. PostgreSQL stores canonical USD values and the original source prize claim; neither ranking nor provenance depends on the selected display currency.
- Unknown and non-cash awards never receive fabricated currency equivalents.

The live frontend release on 2026-08-24 remains `50e7422`; the Luma-capable backend is release `a966298`. GitHub quality run `32651012024` passed for the exact backend release commit. Public verification returned HTTP 200 for the frontend and API health, with 36 worldwide rows and all 11 production Luma rows visible across the four supported countries. Earlier browser verification covered desktop and 390×844 layouts, card-wide and explicit-button opening, modal content, the independent source URL, Escape dismissal, backdrop dismissal, scroll locking, and focus restoration. The card-wide hit target is implemented by stretching the existing semantic detail button rather than making the article a nested interactive control.

Do not call a successful push a deployment. The public routes and current service revisions must be checked separately.

The first authenticated HackRadar workflow dispatch was observed successful on 2026-08-23. Its Devpost refresh completed with three normalized rows and promoted `devpost-global` to `ready`. This proves the configured workflow path; a future cron occurrence remains a separate scheduling observation.

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
