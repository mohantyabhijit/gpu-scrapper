# Submission checklist

## P0 release gate

- [x] Public deployment loads signed out on desktop and mobile widths.
- [ ] Two same-market sources have healthy live output and overlapping models.
- [x] Real create/run flows and stable Dynacore `c_mt3qzv5p215cci1r2e` and PC
      Themes `c_mt3zqdljej45v0g1r` Collector IDs are recorded.
- [x] Same-ID PC Themes heal is proven with sanitized before/after evidence:
      0 rows before, 96 valid rows after, unchanged downstream consumers.
- [x] Manually dispatched GitHub Action has completed and fed PostgreSQL/storefront
      (`32560319450`: 96 provider rows, 96 valid, zero failures; public catalog
      98 offers across two retailers).
- [ ] A cron-triggered occurrence has been separately observed; the schedule is
      configured, but the verified production run above was manual.
- [x] Search, filters, currency grouping, freshness, source attribution, and
      outbound links pass manual keyboard/browser QA at desktop and 390px.
- [x] Automated axe scan reports zero violations across four deployed routes.
- [x] A retained 390 × 844 CSS-pixel responsive screenshot is attached at
      `evidence/screenshots/production-home-mobile-390x844.png`.
- [ ] Last-known-good behavior is visible for a failed/stale source.
- [x] Architecture, evidence matrix, QA report, and demo script are current for
      the two-source Singapore live slice with fixture fallback elsewhere.

## Safety gate

- [x] Exposed setup credential revoked/rotated; the replacement is held in
      macOS Keychain and the Worker secret store, never in the repository.
- [x] Secret scan passes working tree, history, build output, and evidence.
- [x] No login-walled, paywalled, personal, checkout, or arbitrary URL data is
      present in the verified live/fixture slice.
- [x] No claims of checkout, reservation, guaranteed price, or compatibility
      advice.

## Submission package

Include the public repository, deployed URL, short demo, sanitized evidence
links, source eligibility decision, and a concise explanation of how Bright Data
Scraper Studio powers the Dynacore and PC Themes downstream slices. Singapore is
the only live market in this release state; US, UK, and India remain fixture-backed.

## Official Google Form fields

The form screenshots received on 2026-08-21 show the following Page 1 fields.
Do not submit the form until Page 2 is captured and every link is public.

| Field | Planned answer / gate |
| --- | --- |
| Email | Participant must provide and confirm. |
| Team name | Use `SOLO` only if the participant confirms they are entering alone. |
| Person submitting | Participant must provide and confirm. |
| Track | Select all three: Best Use of Bright Data — Web-Slinger; Best UI — Suit-Up; Best Clean Code — Spider-Sense. |
| GitHub project | <https://github.com/mohantyabhijit/gpu-scrapper> after the final branch is merged and public history is verified. |
| Deployed project | <https://abhijitmohanty.com/scrapper/> |
| YouTube demo | **TODO:** public or unlisted video, no more than 3 minutes. |
| What does your project do? | Use the reviewed draft below after live behavior is verified. |
| How did you use Scraper Studio? | Use the reviewed draft below after live Collector evidence exists. |
| LinkedIn giveaway | Optional. Only add a real public post that tags WeMakeDevs and Bright Data. |

### Draft: what Raster does

Raster is the GPU market without the tab circus: a market-local comparison
experience for shoppers in the United States, United Kingdom, India, and
Singapore. It turns public specialist-retailer listings into a consistent view
of model, board partner, VRAM, local price, stock signal, freshness, and source.
Users can search and compare inside USD, GBP, INR, or SGD without misleading
cross-currency rankings, then verify the final offer on the retailer page.
Raster is not a merchant; it makes fragmented regional availability legible.

### Draft: how Raster uses Scraper Studio

Bright Data Scraper Studio is Raster's production data source, not an add-on.
The verified Dynacore collector `c_mt3qzv5p215cci1r2e` and PC Themes collector
`c_mt3zqdljej45v0g1r` are triggered by the protected refresh pipeline, validated
and normalized, written to hosted PostgreSQL via private Hyperdrive, and rendered
as 98 Singapore offers. PC Themes also demonstrates code-owned self-healing: the
same Collector ID recovered from 0 rows to 96 valid rows while hashes prove the
six downstream consumer files stayed unchanged. Manual production run
`32560319450` is green; cron is configured but a scheduled occurrence has not
been separately observed. Infinity Computer remains disabled with 59
`price_required` quarantines and zero validated offers.

The drafts deliberately describe the current evidence boundary. Do not turn the
configured cron into a claim of an observed scheduled run, and describe the
successful heal only as the controlled PC Themes 0-to-96 recovery that is proven.

## Why Raster combines the organizer project patterns

Raster is deliberately one coherent story built from four of the organizer’s
strongest patterns:

1. **Prompt-to-production pipeline:** a source-specific Scraper Studio
   collector produces structured GPU rows, the protected route validates and
   normalizes them, PostgreSQL stores current/history state, and the storefront renders
   the result.
2. **Set a goal and walk away:** the goal is a fresh, market-local catalog; a
   scheduled GitHub Action signs one bounded refresh slice and publishes a
   health summary without dashboard work.
3. **Self-healing scraper (hero):** a controlled PC Themes extraction failure
   is repaired with `bdata scraper heal` under the exact same `c_*` ID; retained
   evidence shows 0 rows before, 96 valid rows after, and unchanged downstream
   consumer hashes.
4. **Scrapers in CI:** the same signed path runs on schedule or manual dispatch,
   validates output, fails safely, and preserves last-known-good data when a
   source is degraded.

The pipeline and same-ID heal above are current verified claims. The video must
still preserve the evidence boundaries in the matrix, especially the unobserved
cron occurrence and incomplete 3-of-3 cross-retailer model-family overlap.

## Three-track winning proof

- **Web-Slinger / Best Use of Bright Data:** show terminal-driven create, run,
  protected trigger, PostgreSQL output, schedule, and the successful bounded
  PC Themes same-ID heal.
- **Suit-Up / Best UI:** show the polished four-market journey, accessible
  filters, market-local currency boundary, model detail, and health surface.
- **Spider-Sense / Best Clean Code:** show typed contracts, allowlists, HMAC
  boundary, quarantine/last-known-good behavior, idempotency, tests, migration,
  and readable public history.

## Required demo video (maximum 3 minutes)

Record to a 2:50–2:55 target so edits, transitions, or encoding never push the
final upload past the organizer’s hard three-minute limit. Use one continuous
terminal/browser capture with a visible clock or chapter card; do not show
private dashboards, account identities, `.env` files, API keys, or raw provider
responses.

1. **0:00–0:20 — About the project:** regional GPU-price fragmentation and the
   four-market product promise.
2. **0:20–0:45 — Tech stack and architecture:** Scraper Studio Collector IDs →
   protected refresh → validation/normalization → private Hyperdrive/VPC PostgreSQL → Raster storefront.
3. **0:45–1:30 — Product demo:** switch markets, filter, open a model, inspect
   freshness/health, and verify at the retailer.
4. **1:30–2:15 — Bright Data proof:** real create/run output and the structured
   row that powers the UI.
5. **2:15–2:45 — Reliability proof:** show the retained PC Themes baseline and
   proof: same Collector ID, 0 rows before, 96 valid rows after, and unchanged
   downstream hashes. Then mention quarantine and last-known-good behavior.
6. **2:45–3:00 — Close:** one sentence each for impact, UI finish, clean code,
   and what was learned.

Never show the API key, authorization headers, `.env`, private account pages,
or unredacted provider output in the recording.
