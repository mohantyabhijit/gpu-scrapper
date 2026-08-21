# Submission checklist

## P0 release gate

- [x] Public deployment loads signed out on desktop and mobile widths.
- [ ] Two same-market sources have healthy live output and overlapping models.
- [ ] At least one real create/run flow and stable Collector ID are recorded.
- [ ] Same-ID heal is proven with sanitized before/preview/after evidence.
- [ ] Scheduled/manual GitHub Action has completed and fed D1/storefront.
- [ ] Search, filters, currency grouping, freshness, source attribution, and
      outbound links pass browser and accessibility QA.
- [ ] Last-known-good behavior is visible for a failed/stale source.
- [ ] README, architecture, evidence matrix, and demo script are current.

## Safety gate

- [ ] Exposed setup credential revoked/rotated.
- [ ] Secret scan passes working tree, history, build output, and evidence.
- [ ] No login-walled, paywalled, personal, checkout, or arbitrary URL data.
- [ ] No claims of checkout, reservation, guaranteed price, or compatibility
      advice.

## Submission package

Include the public repository, deployed URL, short demo, sanitized evidence
links, source eligibility decision, and a concise explanation of how Bright Data
Scraper Studio powers the live downstream product.

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
Each eligible long-tail retailer gets an owned, source-specific collector with a
stable `c_*` ID. The protected refresh pipeline triggers those IDs, validates
and normalizes structured rows, quarantines bad output, preserves last-known-good
offers, writes current state and observations to D1, and feeds the storefront on
a GitHub Actions schedule. The demo shows a real create/run flow and repairs a
broken extractor with `bdata scraper heal`, approval, and a successful rerun
under the same Collector ID—without changing downstream code.

Do not paste these drafts into the form until the claimed live collectors,
schedule, D1 writes, and same-ID heal are proven in the evidence matrix.

## Why Raster combines the organizer project patterns

Raster is deliberately one coherent story built from four of the organizer’s
strongest patterns:

1. **Prompt-to-production pipeline:** a source-specific Scraper Studio
   collector produces structured GPU rows, the protected route validates and
   normalizes them, D1 stores current/history state, and the storefront renders
   the result.
2. **Set a goal and walk away:** the goal is a fresh, market-local catalog; a
   scheduled GitHub Action signs one bounded refresh slice and publishes a
   health summary without dashboard work.
3. **Self-healing scraper (hero):** a controlled contract break is repaired with
   `bdata scraper heal`, approved, and rerun under the exact same `c_*` ID while
   downstream code stays unchanged.
4. **Scrapers in CI:** the same signed path runs on schedule or manual dispatch,
   validates output, fails safely, and preserves last-known-good data when a
   source is degraded.

These are implementation goals, not claims of completion. The submission form
and video must use this language only after the corresponding rows in the
evidence matrix have moved from `pending` to a dated proof link.

## Three-track winning proof

- **Web-Slinger / Best Use of Bright Data:** show terminal-driven create, run,
  protected trigger, D1 output, schedule, and same-ID heal end to end.
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
   protected refresh → validation/normalization → D1 → Raster storefront.
3. **0:45–1:30 — Product demo:** switch markets, filter, open a model, inspect
   freshness/health, and verify at the retailer.
4. **1:30–2:15 — Bright Data proof:** real create/run output and the structured
   row that powers the UI.
5. **2:15–2:45 — Reliability hero:** break, heal, approve, and rerun the same
   Collector ID; show quarantine/last-known-good behavior.
6. **2:45–3:00 — Close:** one sentence each for impact, UI finish, clean code,
   and what was learned.

Never show the API key, authorization headers, `.env`, private account pages,
or unredacted provider output in the recording.
