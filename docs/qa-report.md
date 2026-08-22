# Production QA report

Verified on 2026-08-22 against
<https://abhijitmohanty.com/scrapper/> at deployed/main commit `434e593` and
Cloudflare Worker version `7d9e3c5f-b9f6-4fcb-9590-11ea4b65228a`.

The verified production slice is one live Dynacore source in Singapore. The
public Singapore catalog is live; US, UK, and India remain explicitly
fixture-backed. Hosted PostgreSQL contains sources 1, products 2, offers 2,
observations 2, runs 2, and quarantine 1. Storage is hosted PostgreSQL over
private Hyperdrive. Infinity Computer remains disabled after 59
`price_required` quarantines and zero validated offers.

## Automated gates

- 150/150 unit, migration, ingestion, auth, replay, rate-limit, retry-safety,
  Country Pack, and healing
  evidence tests pass.
- 16/16 integration tests pass against PostgreSQL, covering migration install,
  integrity triggers, append-only healing evidence, transactional rollback,
  idempotent persistence, last-known-good behavior, replay serialization,
  source cooldowns, and expiry cleanup.
- 10/10 production server-render tests pass.
- TypeScript, ESLint, `git diff --check`, the deployment dry run, and the
  repository secret scan pass.
- `axe-core 4.11.4` reports zero automatically detected violations across the
  deployed home, method, health, and representative product-detail routes;
  this complements, rather than replaces, the manual keyboard checks below.
- Green refresh run `32551530109` completed against the deployed path. Quality
  runs `32552183005` and `32552183008` pass; `actionlint v1.7.12` accepts the
  scheduled and quality workflows.
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
- The protected refresh route rejects an unsigned request with HTTP 401. The
  signed refresh path is exercised by green run `32551530109`; provider
  execution and database persistence remain separate evidence boundaries.

## Browser test results

**Driver:** Codex in-app browser  
**Public server:** <https://abhijitmohanty.com/scrapper/>  
**Result:** PASS for the deployed one-source Singapore live slice with explicit
fixture fallback for US, UK, and India; self-heal remains a separate release
gate.

| Route / flow | Status | Notes |
| --- | --- | --- |
| `/scrapper/` | Pass | Hero, explicit fixture disclosure, navigation, market/search/availability/sort controls, multi-select filters, cards, exact UTC timestamps, source attribution, and local-currency copy render. |
| Multi-filter + sort | Pass | Selecting RTX 5080, B&H Photo, and price-high produces a deterministic repeated-filter URL, removable chips, and exactly one matching offer. |
| `/scrapper/how-it-works` | Pass | Country Pack, custom collector, normalization, and same-ID repair stages render. |
| `/scrapper/data-health` | Pass | Singapore live normalized rows are shown separately from fixture-only US/UK/India cards; Country Pack ledger, seven-stage heal timeline, and pending evidence gates render. |
| `/scrapper/gpu/rtx-5080?market=us` | Pass | Market-local product detail renders with no application error. |
| Mobile 390 × 844 | Pass | Homepage, method, health, and detail routes render with no horizontal overflow (`scrollWidth = innerWidth = 390`). |
| Keyboard focus | Pass | Representative brand, navigation, select, text input, checkbox, button, and outbound-link controls expose a `2px` solid lime focus outline. |
| Retailer exits | Pass | Fixture cards preserve the expected public Micro Center and B&H HTTPS destinations and open them with `target="_blank" rel="noreferrer"`. |
| Portfolio isolation | Pass | `/` and `/data-health` remain portfolio routes; only `/scrapper/` is proxied to Raster. |
| Raster identity | Pass | Browser title is Raster-specific; the v2 GPU-card favicon is published as SVG, PNG, ICO, and Apple Touch variants with cache-busting metadata; the scoped manifest resolves at `/scrapper/manifest.webmanifest`; browser console reports zero errors. |
| Protected API | Pass | Unsigned `POST /scrapper/api/refresh` returns sanitized `401 {"error":"unauthorized"}`. |
| Screenshot artifact | Pass | `evidence/screenshots/production-home-mobile-390x844.png` captures the deployed home at an emulated 390 × 844 CSS-pixel iPhone viewport (3× PNG); all three navigation links and hero copy are visible without clipping. |

No browser console warnings or errors were recorded across the final production
route pass. The page exposes semantic headings, labelled controls, navigation,
regions, status text, exact timestamps, and visible fixture/live disclosures.
The responsive artifact was visually inspected after capture; it complements
the exact viewport/overflow measurements above.

## Known honest limitations

- US, UK, and India storefront rows remain explicitly labelled fixtures; the
  Singapore cards are backed by the two live Dynacore offers.
- Self-heal remains unproved. Multiple same-ID previews exist, one approval has
  status `done` but its rerun still reports 2 accepted rows and 1 accessory
  quarantine, and other approvals failed without changing the collector.
- Infinity Computer remains disabled because all 59 exact-GPU rows were
  `price_required`; no second-source breadth, 12-offer threshold, or successful
  self-heal is claimed.
- `npm audit` reports four moderate issues in development tooling. The only
  proposed automated remediation is a forced breaking downgrade, so it was not
  applied to the production build.
