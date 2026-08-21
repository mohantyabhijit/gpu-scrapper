# Production QA report

Verified on 2026-08-21 against
<https://abhijitmohanty.com/scrapper/> after Cloudflare Worker version
`809b0587-fac7-48d6-b23d-171aa5bf77d5` was deployed from commit `6221860`.

## Automated gates

- 83/83 unit, migration, ingestion, auth, replay, rate-limit, retry-safety,
  Country Pack, and healing
  evidence tests pass.
- 10/10 integration tests pass against PostgreSQL, covering migration install,
  integrity triggers, append-only healing evidence, transactional rollback,
  idempotent persistence, last-known-good behavior, replay serialization,
  source cooldowns, and expiry cleanup.
- 6/6 production server-render tests pass.
- TypeScript, ESLint, `git diff --check`, the deployment dry run, and the
  repository secret scan pass.
- `axe-core 4.11.4` reports zero automatically detected violations across the
  deployed home, method, health, and representative product-detail routes;
  this complements, rather than replaces, the manual keyboard checks below.
- The GitHub push and pull-request `Raster quality` runs for cutover
  commit `6221860` pass; `actionlint v1.7.12` accepts the scheduled and quality
  workflows.
- Hosted PostgreSQL contains the applied migrations and the expected production
  tables, including `market_packs`, `request_receipts`, and `healing_events`.
  PostgreSQL integration tests prove unique country/source constraints, the
  complete ready collector boundary, pending-to-ready updates, append-only
  healing evidence, and all-or-nothing Country Pack writes.
- The source D1 database and destination PostgreSQL database both contained
  zero application rows at cutover, so no catalog or evidence data required
  transfer. `evidence/postgres-cutover/count-reconciliation.json` records the
  table-by-table reconciliation without credentials.
- The deployed `/api/storage-health` route completes a safe `SELECT 1` through
  Cloudflare Tunnel, Workers VPC, and Hyperdrive. Both the Worker origin and
  portfolio path return HTTP 200 with the sanitized hosted-PostgreSQL boundary.
- The final Worker binding list contains `HYPERDRIVE` and static assets only;
  the D1 binding was removed after the private PostgreSQL smoke check passed.
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
| Raster identity | Pass | Browser title is Raster-specific; shortcut, standard, and Apple icon metadata resolve to `/scrapper/favicon.svg`; the scoped manifest resolves at `/scrapper/manifest.webmanifest`; browser console reports zero errors. |
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
  PostgreSQL writes, a green scheduled Action, and same-ID heal artifacts remain
  pending until the previously exposed Bright Data key is revoked and replaced.
- `npm audit` reports four moderate issues in development tooling. The only
  proposed automated remediation is a forced breaking downgrade, so it was not
  applied to the production build.
