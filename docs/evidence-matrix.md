# Organizer evidence matrix

This is a release-facing index. Replace `pending` with a link to a sanitized
artifact, commit, Action run, or public URL as each gate is completed.

| Organizer expectation | Proof required | Planned artifact/surface | Status |
| --- | --- | --- | --- |
| Bright Data at the core | Real create and run flow with stable `c_*` ID | `evidence/collectors/`, source registry | Dynacore `c_mt3qzv5p215cci1r2e` and PC Themes `c_mt3zqdljej45v0g1r` feed the deployed Singapore slice; PC Themes also has successful same-ID healing proof |
| Long-tail target | Pre-built-library exclusion and source eligibility | `docs/source-eligibility.md` plus dated evidence | Dynacore and PC Themes proven; PC Themes library exclusion is recorded; Infinity exclusion and failed numeric-price gate remain recorded |
| Public data only | Signed-out URLs and data-boundary review | `docs/security.md`, source register | baseline |
| Collector as production API | Trigger/schedule feeding hosted PostgreSQL via private Hyperdrive and storefront | GitHub Action summary, run record, public catalog | verified: PC Themes refresh run `32560319450` returned 96 provider rows, 96 valid rows, and zero failures; the public catalog renders 98 normalized rows across two retailers |
| Terminal is the UI | Reproducible CLI commands and concise outputs | `docs/demo-script.md`, sanitized transcript | commands and sanitized Dynacore create/run transcript recorded; provider bodies remain omitted |
| Code ownership | Versioned manifests, validator, normalizer, pipeline | repository code, 165 unit/security tests, 16 PostgreSQL tests, 10 rendered-output tests, and public commit history | implemented; quality run `32560226787` is green |
| Self-healing | Before/preview/after proof using same Collector ID | `evidence/healing/` | proven: PC Themes recovered from 0 rows to 96 valid rows under collector `c_mt3zqdljej45v0g1r`; the six hashed downstream consumer files remained unchanged |
| Scrapers in CI | Scheduled/manual workflow with green validation | `.github/workflows/collect.yml` and Action run | manual refresh run `32560319450` and quality run `32560226787` are green; cron is configured but a scheduled occurrence has not been separately observed |
| Downstream product | Normalized offers rendered in storefront | <https://abhijitmohanty.com/scrapper/> and `docs/qa-report.md` | deployed Singapore live catalog with 98 offers across Dynacore and PC Themes; US, UK, and India remain explicitly fixture-backed |
| Prompt-to-production | Collector output crosses validation, hosted PostgreSQL, and storefront boundaries | sanitized row, PostgreSQL run, public offer card | Dynacore and PC Themes cross the boundary; the final PC Themes run persisted 96 valid rows with zero failures |
| Goal/schedule | One bounded market/source slice runs unattended on schedule | `.github/workflows/collect.yml`, Action summary | manual PC Themes slice `32560319450` is green and reaches hosted PostgreSQL through private Hyperdrive; cron is configured, but a scheduled occurrence has not been separately observed |
| Runtime country onboarding | Ready Country Pack appears in the selector only after eligibility, collector, and contract evidence | `/data-health` Country Packs ledger, append-only evidence ledger, PostgreSQL market-pack row, protected refresh plan | pending-only admission, evidence-bound promotion, and fail-closed runtime seam implemented; real Country Pack pending |
| Self-healing hero | Same `c_*` ID recovers after a controlled break | `evidence/healing/pc-themes-baseline.json` and `evidence/healing/pc-themes-proof.json` | proven: 0 before, 96 after, 96 valid after, same collector ID, downstream unchanged |
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
| Reliability and self-healing | Invalid rows quarantine and last-known-good behavior are implemented; PC Themes has a successful same-ID repair | Failure fixtures plus the 0-to-96 same-ID proof and unchanged-downstream hashes |
| Presentation | A concise problem → scraper → structured row → storefront → repair story | Rehearsed 2–3 minute demo and sanitized evidence index |

## Evidence rules

Evidence must be reproducible, dated, and sanitized. Never include a key,
cookie, bearer token, private dashboard identity, raw authorization header,
personal data, or unrestricted provider error body. A Collector ID proves
identity, not credential access.
