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
   redacted custom Scraper Studio create/run command, one stable `c_*` ID, the
   valid-row count, currency, and timestamp. Name the long-tail source and
   point to its eligibility record; never show credentials or raw headers.
3. **0:45–1:30 — Product and UI proof.** Switch between the four market views,
   filter one market, open a model detail page, and follow an attributed
   retailer link. Call out same-currency ranking, freshness/health labels, and
   “verify at retailer.” The visible catalog must say `live` only when backed by
   a verified live row; otherwise keep the fixture label.
4. **1:30–2:15 — Prompt-to-production and scheduled goal.** Show the structured
   collector row crossing validation/normalization into D1 and the storefront,
   then show the GitHub Action summary for one scheduled/manual market-source
   slice. Explain that the unattended goal is a fresh, market-local catalog,
   not a dashboard-only scraper.
5. **2:15–2:45 — Self-healing hero.** Show the sanitized failing contract,
   `bdata scraper heal` preview, approval, and rerun. Highlight the exact same
   Collector ID before and after, with no downstream code change. Show that
   invalid output quarantines and last-known-good data survives.
6. **2:45–3:00 — Close against the rubric.** Give one sentence each for
   impact, creativity, technical excellence, Scraper Studio use, reliability,
   and presentation. End with: “Raster never takes payment or guarantees
   stock; shoppers verify the retailer’s current offer.”

## Organizer-pattern explanation

The demo intentionally combines four organizer project patterns into one
vertical story: prompt-to-production collection, a goal that runs on schedule,
self-healing scraper ownership, and scrapers in CI. The storefront is the
useful downstream product; the terminal, Collector ID, Action summary, and
before/after heal evidence are the proof surfaces.

## Recording safety

- Do not show the Bright Data API key, HMAC secret, `.env`, cookies, private
  account pages, dashboard identity, or unredacted provider output.
- Do not claim a live collector, D1 write, schedule, or heal until its evidence
  row is dated and linked.
- If a required live gate is still pending, stop the recording and fix the gate;
  do not substitute a fixture while narrating it as production behavior.
