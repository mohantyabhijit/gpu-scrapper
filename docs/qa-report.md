# Production QA report

Verified on 2026-08-21 against
<https://abhijitmohanty.com/scrapper/> after Cloudflare Worker version
`1a87d810-a018-4172-a7b5-39d1b32f45a1` was deployed.

## Automated gates

- 59/59 unit, migration, ingestion, auth, replay, Country Pack, and healing
  evidence tests pass.
- 5/5 production server-render tests pass.
- TypeScript, ESLint, `git diff --check`, the deployment dry run, and the
  repository secret scan pass.
- Remote D1 contains all five applied migrations and the expected production
  tables, including `market_packs`, `request_receipts`, and `healing_events`.
  Country Pack tests also force the second batched write to fail and verify the
  first write is rolled back.
- The protected refresh route rejects an unsigned request with HTTP 401. A
  correctly signed request reaches the route and returns the expected HTTP 503
  while live Collector IDs/provider access remain intentionally unconfigured.

## Browser test results

**Driver:** Codex in-app browser  
**Public server:** <https://abhijitmohanty.com/scrapper/>  
**Result:** PASS for the deployed fixture-backed slice; live collector proof is
still a separate release gate.

| Route / flow | Status | Notes |
| --- | --- | --- |
| `/scrapper/` | Pass | Hero, disclosure, navigation, filters, cards, retailer attribution, and local-currency copy render. |
| Market + search | Pass | Selecting India and filtering `5070` produces `?market=india&q=5070...`, INR output, and removes the 5080 card. |
| `/scrapper/how-it-works` | Pass | Country Pack, custom collector, normalization, and same-ID repair stages render. |
| `/scrapper/data-health` | Pass | Honest no-live-claim state, four markets, Country Pack ledger, seven-stage heal timeline, and pending evidence gates render. |
| `/scrapper/gpu/rtx-5070-ti?market=india` | Pass | Market-local product detail renders with no application error. |
| Mobile 390 × 844 | Pass | Hero, primary navigation, market selector, and cards render with no horizontal overflow (`scrollWidth = innerWidth = 390`). |
| Portfolio isolation | Pass | `/` and `/data-health` remain portfolio routes; only `/scrapper/` is proxied to Raster. |
| Protected API | Pass | Unsigned `POST /scrapper/api/refresh` returns sanitized `401 {"error":"unauthorized"}`. |

No browser console warnings or errors were recorded on the final production
homepage pass. The page exposes semantic headings, labelled controls,
navigation, regions, status text, and visible fixture/live disclosures. A
formal assistive-technology audit remains part of final submission polish.

## Known honest limitations

- Storefront rows are still explicitly labelled fixtures.
- Live Bright Data Collector IDs, source eligibility evidence, collector-backed
  D1 writes, a green scheduled Action, and same-ID heal artifacts remain
  pending until the previously exposed Bright Data key is revoked and replaced.
- `npm audit` reports four moderate issues in development tooling. The only
  proposed automated remediation is a forced breaking downgrade, so it was not
  applied to the production build.
