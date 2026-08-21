# Production QA report

Verified on 2026-08-21 against
<https://abhijitmohanty.com/scrapper/> after Cloudflare Worker version
`6e334165-43ea-4e79-af8c-1ebb90a1c273` was deployed from commit `f57cf56`.

## Automated gates

- 81/81 unit, migration, ingestion, auth, replay, rate-limit, retry-safety,
  Country Pack, and healing
  evidence tests pass.
- 6/6 production server-render tests pass.
- TypeScript, ESLint, `git diff --check`, the deployment dry run, and the
  repository secret scan pass.
- `axe-core 4.11.4` reports zero automatically detected violations across the
  deployed home, method, health, and representative product-detail routes;
  this complements, rather than replaces, the manual keyboard checks below.
- The GitHub push and pull-request `Raster quality` runs for security-fix
  commit `f57cf56` pass; `actionlint v1.7.12` accepts the scheduled and quality
  workflows.
- Remote D1 contains all six applied migrations and the expected production
  tables, including `market_packs`, `request_receipts`, and `healing_events`.
  The three Country Pack immutability triggers were queried from remote
  `sqlite_master` after migration `0005` applied. SQLite tests prove unique
  country/source constraints, the complete ready collector boundary, and
  pending-to-ready update behavior. Country Pack tests also force the second
  batched write to fail and verify the first write is rolled back.
- Direct SQLite-backed tests persist and reload all seven same-ID healing
  stages and serialize concurrent source-rate claims through the real unique
  receipt key; route tests cover bounded input and replay cleanup failures.
- A production D1 binding smoke check inserted and read a uniquely named QA
  receipt, immediately deleted it, and verified `residue = 0`. No catalog row
  was touched.
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
| `/scrapper/` | Pass | Hero, explicit fixture disclosure, navigation, market/search/availability/sort controls, multi-select filters, cards, exact UTC timestamps, source attribution, and local-currency copy render. |
| Multi-filter + sort | Pass | Selecting RTX 5080, B&H Photo, and price-high produces a deterministic repeated-filter URL, removable chips, and exactly one matching offer. |
| `/scrapper/how-it-works` | Pass | Country Pack, custom collector, normalization, and same-ID repair stages render. |
| `/scrapper/data-health` | Pass | Honest no-live-claim state, four markets, Country Pack ledger, seven-stage heal timeline, and pending evidence gates render. |
| `/scrapper/gpu/rtx-5080?market=us` | Pass | Market-local product detail renders with no application error. |
| Mobile 390 × 844 | Pass | Homepage, method, health, and detail routes render with no horizontal overflow (`scrollWidth = innerWidth = 390`). |
| Keyboard focus | Pass | Representative brand, navigation, select, text input, checkbox, button, and outbound-link controls expose a `2px` solid lime focus outline. |
| Retailer exits | Pass | Fixture cards preserve the expected public Micro Center and B&H HTTPS destinations and open them with `target="_blank" rel="noreferrer"`. |
| Portfolio isolation | Pass | `/` and `/data-health` remain portfolio routes; only `/scrapper/` is proxied to Raster. |
| Protected API | Pass | Unsigned `POST /scrapper/api/refresh` returns sanitized `401 {"error":"unauthorized"}`. |
| Screenshot artifact | Pass | `evidence/screenshots/production-home-mobile-390x844.png` captures the deployed home at an emulated 390 × 844 CSS-pixel iPhone viewport (3× PNG); all three navigation links and hero copy are visible without clipping. |

No browser console warnings or errors were recorded across the final production
route pass. The page exposes semantic headings, labelled controls, navigation,
regions, status text, exact timestamps, and visible fixture/live disclosures.
The responsive artifact was visually inspected after capture; it complements
the exact viewport/overflow measurements above.

## Known honest limitations

- Storefront rows are still explicitly labelled fixtures.
- Live Bright Data Collector IDs, source eligibility evidence, collector-backed
  D1 writes, a green scheduled Action, and same-ID heal artifacts remain
  pending until the previously exposed Bright Data key is revoked and replaced.
- `npm audit` reports four moderate issues in development tooling. The only
  proposed automated remediation is a forced breaking downgrade, so it was not
  applied to the production build.
