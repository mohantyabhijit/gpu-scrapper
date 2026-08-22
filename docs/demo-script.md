# Judge demo script

Record a 2:50–2:55 target. The organizer’s hard limit is three minutes, so do
not add an unplanned intro, outro, or title card after this timeline. Use a
clean signed-out browser, a terminal with masked output, and only sanitized
evidence that already has a dated link in the evidence matrix.

## Exact three-minute timeline

1. **0:00–0:20 — Problem and impact.** Open Raster and say: “GPU shoppers
   jump between regional retailers, currencies, and unreliable stock labels.
   Raster makes public specialist listings comparable while sending the final
   purchase decision back to the retailer.”
2. **0:20–0:45 — Why this is a scraper product.** In the terminal, show the
   redacted Dynacore Scraper Studio create/run command, stable Collector ID
   `c_mt3qzv5p215cci1r2e`, two accepted rows, one accessory quarantine, SGD,
   and observed timestamps. Name the source and point to its eligibility
   record; never show credentials or raw headers.
3. **0:45–1:20 — Market-local UI proof.** Show Singapore's two live Dynacore
   offers in the health/catalog surface, then switch through the US, UK, and
   India fixture views. Filter Singapore, open a model detail page, and follow
   an attributed retailer link. Call out same-currency ranking,
   freshness/health labels, and “verify at retailer.” The visible catalog must
   say `live` only when backed by a verified live row; keep fixture labels for
   the other markets.

   Rehearse this beat with the exact pending and ready payload sequence in
   [operations.md](operations.md#exact-country-pack-rehearsal). The terminal
   should show only the safe `{slug,status}` responses; the two payloads must
   keep the same verified country/source/collector boundary.
4. **1:20–2:05 — Prompt-to-production and automation goal.** Show the structured
   Dynacore rows crossing validation/normalization into hosted PostgreSQL via
   private Hyperdrive and the storefront, including safe counts (sources 1,
   products 2, offers 2, observations 2, runs 2, quarantine 1). Then show
   green refresh run `32551530109` and quality runs `32552183005` and
   `32552183008`. Identify `32551530109` as a manual dispatch, then show that
   cron is configured without claiming a scheduled occurrence was observed.
   Explain that the unattended goal is a fresh, market-local catalog, not a
   dashboard-only scraper.
5. **2:05–2:45 — Honest self-healing boundary.** Open the visible Data Health
   timeline, then show the sanitized failing contract and same-ID
   `bdata scraper heal` previews. State plainly that self-heal is unproved:
   one approval is `done` but its rerun remains 2 accepted / 1 accessory
   quarantined, while other approvals failed without changing the collector.
   Show quarantine/last-known-good behavior without narrating a successful
   repair.
6. **2:45–3:00 — Close against the rubric.** Give one sentence each for
   impact, creativity, technical excellence, Scraper Studio use, reliability,
   and presentation. End with: “Raster never takes payment or guarantees
   stock; shoppers verify the retailer’s current offer.”

## Organizer-pattern explanation

The demo intentionally combines four organizer project patterns into one
vertical story: prompt-to-production collection, a goal wired for a schedule,
self-healing scraper ownership, and scrapers in CI. The storefront is the
useful downstream product; the terminal, Collector ID, Action summary, and
before/after heal evidence are the proof surfaces.

## Recording safety

- Do not show the Bright Data API key, HMAC secret, `.env`, cookies, private
  account pages, dashboard identity, or unredacted provider output.
- Do not claim a live collector, PostgreSQL write, schedule, or heal until its evidence
  row is dated and linked.
- If a required live gate is still pending, say so in the recording; do not
  substitute a fixture while narrating it as production behavior, and do not
  claim two-source breadth, 12 offers, or a successful self-heal.
