# Organizer evidence matrix

This is a release-facing index. Replace `pending` with a link to a sanitized
artifact, commit, Action run, or public URL as each gate is completed.

| Organizer expectation | Proof required | Planned artifact/surface | Status |
| --- | --- | --- | --- |
| Bright Data at the core | Real create and run flow with stable `c_*` ID | `evidence/collectors/`, source registry | Dynacore `c_mt3qzv5p215cci1r2e` proven and feeding the deployed slice; Infinity create/run/repeat-read recorded but invalid output |
| Long-tail target | Pre-built-library exclusion and source eligibility | `docs/source-eligibility.md` plus dated evidence | Dynacore proven; Infinity exclusion and failed numeric-price gate recorded |
| Public data only | Signed-out URLs and data-boundary review | `docs/security.md`, source register | baseline |
| Collector as production API | Trigger/schedule feeding hosted PostgreSQL via private Hyperdrive and storefront | GitHub Action summary, run record, public catalog | verified: green refresh run `32551530109`; hosted PostgreSQL sources 1, products 2, offers 2, observations 2, runs 2, quarantine 1 |
| Terminal is the UI | Reproducible CLI commands and concise outputs | `docs/demo-script.md`, sanitized transcript | commands and sanitized Dynacore create/run transcript recorded; provider bodies remain omitted |
| Code ownership | Versioned manifests, validator, normalizer, pipeline | repository code, 81 core tests, 6 rendered-output tests, and public commit history | implemented |
| Self-healing | Before/preview/after proof using same Collector ID | `evidence/healing/` | unproved: multiple same-ID previews exist; one approval is `done` but its rerun remains 2 accepted / 1 accessory quarantined, and other approvals failed without collector change |
| Scrapers in CI | Scheduled/manual workflow with green validation | `.github/workflows/collect.yml` and Action run | manual refresh run `32551530109` is green; quality runs `32552183005` and `32552183008` are green; cron is configured but a scheduled occurrence has not been separately observed |
| Downstream product | Normalized offers rendered in storefront | <https://abhijitmohanty.com/scrapper/> and `docs/qa-report.md` | deployed Singapore live catalog with 2 Dynacore offers; US, UK, and India remain explicitly fixture-backed |
| Prompt-to-production | Collector output crosses validation, hosted PostgreSQL, and storefront boundaries | sanitized row, PostgreSQL run, public offer card | Dynacore crosses the boundary; Infinity has 59 `price_required` quarantines and 0 validated offers |
| Goal/schedule | One bounded market/source slice runs unattended on schedule | `.github/workflows/collect.yml`, Action summary | manual slice `32551530109` is green and reaches hosted PostgreSQL through private Hyperdrive; cron is configured, but a scheduled occurrence has not been separately observed |
| Runtime country onboarding | Ready Country Pack appears in the selector only after eligibility, collector, and contract evidence | `/data-health` Country Packs ledger, append-only evidence ledger, PostgreSQL market-pack row, protected refresh plan | pending-only admission, evidence-bound promotion, and fail-closed runtime seam implemented; real Country Pack pending |
| Self-healing hero | Same `c_*` ID recovers after a controlled break | `evidence/healing/` before/preview/after set | unproved; do not narrate the approval/rerun sequence as a successful heal |
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
| Reliability and self-healing | Invalid rows quarantine and last-known-good behavior are implemented; same-ID repair remains unproved | Failure fixture and same-ID before/preview/after transcript; quarantine is verified but current approval/rerun evidence is not a successful heal |
| Presentation | A concise problem → scraper → structured row → storefront → repair story | Rehearsed 2–3 minute demo and sanitized evidence index |

## Evidence rules

Evidence must be reproducible, dated, and sanitized. Never include a key,
cookie, bearer token, private dashboard identity, raw authorization header,
personal data, or unrestricted provider error body. A Collector ID proves
identity, not credential access.
