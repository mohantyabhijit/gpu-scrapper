# Organizer evidence matrix

This is a release-facing index. Replace `pending` with a link to a sanitized
artifact, commit, Action run, or public URL as each gate is completed.

| Organizer expectation | Proof required | Planned artifact/surface | Status |
| --- | --- | --- | --- |
| Bright Data at the core | Real create and run flow with stable `c_*` ID | `evidence/collectors/`, terminal transcript, source registry | pending |
| Long-tail target | Pre-built-library exclusion and source eligibility | `docs/source-eligibility.md` plus dated evidence | pending |
| Public data only | Signed-out URLs and data-boundary review | `docs/security.md`, source register | baseline |
| Collector as production API | Trigger/schedule feeding hosted PostgreSQL via private Hyperdrive and storefront | GitHub Action summary, run record, public catalog | pending |
| Terminal is the UI | Reproducible CLI commands and concise outputs | `docs/demo-script.md`, sanitized transcript | commands implemented; live transcript pending |
| Code ownership | Versioned manifests, validator, normalizer, pipeline | repository code, 81 core tests, 6 rendered-output tests, and public commit history | implemented |
| Self-healing | Before/preview/after proof using same Collector ID | `evidence/healing/` | pending |
| Scrapers in CI | Scheduled/manual workflow with green validation | `.github/workflows/collect.yml` and Action run | four-market matrix and syntax validated; live run pending |
| Downstream product | Normalized offers rendered in storefront | <https://abhijitmohanty.com/scrapper/> and `docs/qa-report.md` | deployed fixture slice; live ingestion pending |
| Prompt-to-production | Collector output crosses validation, hosted PostgreSQL, and storefront boundaries | sanitized row, PostgreSQL run, public offer card | pending |
| Goal/schedule | One bounded market/source slice runs unattended on schedule | `.github/workflows/collect.yml`, Action summary | per-slice locking and four-country schedule implemented; live run pending |
| Runtime country onboarding | Ready Country Pack appears in the selector only after eligibility, collector, and contract evidence | `/data-health` Country Packs ledger, append-only evidence ledger, PostgreSQL market-pack row, protected refresh plan | pending-only admission, evidence-bound promotion, and fail-closed runtime seam implemented; real Country Pack pending |
| Self-healing hero | Same `c_*` ID recovers after a controlled break | `evidence/healing/` before/preview/after set | pending |
| Safety and honesty | Freshness, stale/degraded labels, source links, no checkout claim | storefront QA and README | baseline |

## Equal-weight judging scorecard

The demo is scored as hard as the code. Release requires a visible proof beat
for all six equally weighted criteria.

| Judging criterion | Raster answer | Release proof |
| --- | --- | --- |
| Potential impact | Reduce the regional GPU-price tab hunt across US, UK, India, and Singapore | Four-market journey, local currency, attributed retailer handoff |
| Creativity and innovation | Market-isolated structured extraction plus explainable freshness and source health | Market switch, normalized identity, stale/degraded behavior |
| Technical excellence | Typed contracts, currency invariants, idempotent persistence, protected automation | Tests, PostgreSQL schema, green CI, browser QA |
| Use of Scraper Studio | Live collectors are the production data source, not a decorative integration | Stable `c_*` create/run proof feeding the rendered catalog |
| Reliability and self-healing | Invalid rows quarantine, last-known-good survives, same collector heals in place | Failure fixture and same-ID before/preview/after transcript |
| Presentation | A concise problem → scraper → structured row → storefront → repair story | Rehearsed 2–3 minute demo and sanitized evidence index |

## Evidence rules

Evidence must be reproducible, dated, and sanitized. Never include a key,
cookie, bearer token, private dashboard identity, raw authorization header,
personal data, or unrestricted provider error body. A Collector ID proves
identity, not credential access.
