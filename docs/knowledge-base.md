# Raster knowledge base

This is the durable operational source of truth for Raster. It is written for a
developer or coding agent resuming the project without prior conversation
history. Evidence files remain authoritative for proof, and live state must be
re-checked before making time-sensitive claims.

**Last reconciled:** 2026-08-23

**Repository:** <https://github.com/mohantyabhijit/gpu-scrapper>

**Public product:** <https://abhijitmohanty.com/scrapper/>

## 1. Product and user

Raster is a GPU sourcing and market-intelligence storefront for company buyers,
procurement teams, builders, and researchers. It replaces a retailer-tab hunt
with a market-local comparison desk containing model identity, board partner,
VRAM, observed price, availability signal, freshness, source health, and a
canonical retailer link.

Raster deliberately stops before commerce. It does not sell, reserve, take
payment, guarantee inventory, convert currencies, or provide warranty or
compatibility advice. The retailer page is authoritative.

### Market truth

| Shopper market | Currency | Current data mode |
| --- | --- | --- |
| United States | USD | fixture-backed |
| United Kingdom | GBP | fixture-backed |
| India | INR | fixture-backed |
| Singapore | SGD | live PostgreSQL catalog |

Fixture markets are useful for the cross-market product demonstration but must
remain visibly disclosed until real sources clear every eligibility and
collection gate.

## 2. System architecture

```text
Public allowlisted retailer pages
  -> custom Bright Data Scraper Studio collector
  -> protected Raster refresh endpoint
  -> bounded trigger and dataset polling
  -> source adapter and strict shared contract
  -> normalization plus quarantine
  -> hosted PostgreSQL through private Cloudflare Hyperdrive/VPC
  -> market-isolated catalog queries
  -> Cloudflare Worker
  -> abhijitmohanty.com/scrapper/ proxy
  -> retailer verification link
```

Key ownership boundaries:

- `config/markets.ts` defines the four baseline markets and local currencies.
- `config/sources.ts` owns code-approved baseline retailer bindings and
  Collector IDs.
- `lib/brightdata/` owns provider triggering, polling, response bounds, and
  sanitized failures.
- source adapters map provider-specific rows into the shared contract.
- `lib/ingest.ts` validates, normalizes, quarantines, and persists a run.
- `lib/postgres/` and `db/schema.ts` own production persistence and catalog
  queries.
- `app/api/refresh/route.ts` owns the protected production trigger boundary.
- `app/page.tsx` and `components/` own the sourcing storefront.
- `.github/workflows/collect.yml` obtains the protected ready-source plan and
  signs one bounded source slug per job.

## 3. Verified source registry

### Enabled Singapore sources

| Source | Slug | Role | Collector ID | Registered target | Verified behavior |
| --- | --- | --- | --- | --- | --- |
| Dynacore Technologies | `dynacore` | primary | `c_mt3qzv5p215cci1r2e` | <https://dynacoretech.com/collections/gpu> | Two GPU rows accepted; accessory rejected |
| PC Themes | `pc-themes` | secondary | `c_mt3zqdljej45v0g1r` | <https://www.pcthemes.com.sg/video-card-graphics-card> | Same-ID healed collector; 96/96 rows valid in the latest verified refresh |

The public Singapore catalog last rendered 98 normalized rows across these two
retailers. Re-check the live page and latest refresh before repeating that count.

### Disabled and rejected sources

- Infinity Computer (`infinity-computer`) is disabled: 59 exact-GPU rows had no
  numeric price, so every row failed `price_required`.
- TechDeals (`tech-deals`) is rejected because its terms prohibit automated
  extraction.
- US, UK, and India candidates are registered but disabled and have no approved
  Collector IDs.
- Never use SecondSpin collector `c_mt2nbsqd1akac96fiz`; it belongs to a
  different product and target.

The full eligibility and rejection record is in
[`source-eligibility.md`](source-eligibility.md).

### Scraper Studio inventory and electronics pilots

Scraper Studio is the provider-owned collection and recovery layer, not a
one-off demo step. Raster exposes the public collector inventory on the Data
health page while keeping production triggering source-bound and signed.

Production GPU collectors remain:

- Dynacore GPU: `c_mt3qzv5p215cci1r2e`;
- PC Themes GPU: `c_mt3zqdljej45v0g1r`.

Three category pilots were created on 2026-08-23 and are deliberately excluded
from the shopper catalog until their own schemas and ingestion boundaries are
production-ready:

- Dynacore RAM: `c_mt5h2qen1bkc7nbywu`, fixed to
  <https://dynacoretech.com/collections/ram>. The first live run returned 20
  public product rows with numeric SGD prices and allowed retailer URLs, but
  validation caught a capacity parse error on a 128GB RDIMM whose title also
  contains `32Gbit`. It remains a generated pilot pending same-ID repair and a
  clean rerun.
- iStudio Mac mini: `c_mt5h72hcow8slxb6t`, fixed to
  <https://www.istudiosg.com/collections/mac-mini>. Initial AI generation
  ended in provider error after the template was created. Preserve the ID and
  repair in place; do not replace it with another collector or claim a valid
  run until a non-empty contract-checked rerun exists.
- Dynacore NVIDIA DGX Spark: `c_mt5hxrzckttss9n11`, fixed to the public
  Singapore PDP for model SKU/MPN `810152850381`. Its initial one-row output
  had eight schema defects; same-ID healing corrected the identity, URL, chip,
  price/currency, specification, and timestamp contract. The rerun produced
  1/1 valid row: SGD 8,499, `Few Left`, NVIDIA GB10 Grace Blackwell, 128GB
  DDR5x, and 4TB storage. It is a validated Studio pilot, not yet an enabled
  shopper-catalog source.

The authenticated Bright Data dashboard also contains an Infinity Computer GPU
collector and an unfinished zero-delivery Dynacore duplicate. Neither is an
approved production binding. TechDeals remains rejected by policy and must not
receive a collector. US, UK, and India approved collectors are still absent.

## 4. Collection and refresh contract

The deployed refresh route accepts registered source slugs and role only. It
does not accept a target URL or Collector ID from the caller. Requests require:

- `X-Raster-Timestamp` within the five-minute replay window;
- `X-Raster-Signature` over `timestamp + "." + exact_body_bytes` using
  HMAC-SHA256;
- HTTPS, a bounded request body, one allowlisted source slice, and an available
  source-rate lease.

A successful production refresh must include at least one valid row. A provider
completion with zero validated rows is a failure, not a green no-op. Provider
and persistence failures are sanitized, the replay claim is safely released
when retry is allowed, and the last-known-good catalog is preserved.

### Scheduled sources

The daily workflow signs a request to `/api/refresh-plan`, validates the bounded
slug-only response, and creates one independently locked job for every enabled
baseline source and ready runtime Country Pack source. Manual dispatch accepts
one safe source slug; the refresh route still resolves its URL, currency, and
Collector ID server-side and rejects unknown, pending, or disabled sources.

The current production plan contains the two enabled Singapore sources.
US, UK, and India remain fixture-backed and outside the plan until they have
live-proven collectors. A manual run proves the pipeline, not that cron fired.

## 5. PostgreSQL model

Production persistence is hosted PostgreSQL reached privately through
Cloudflare Hyperdrive binding `HYPERDRIVE`. D1 was removed and must not be
reintroduced.

The schema has ten core tables:

- `sources`
- `products`
- `offers`
- `price_observations`
- `collector_runs`
- `quarantined_rows`
- `request_receipts`
- `market_packs`
- `market_pack_evidence`
- `healing_events`

Important invariants:

- price is stored in currency minor units;
- current offers and append-only observations are separate;
- replay/source leases serialize competing requests;
- a run is transactionally all-or-nothing;
- persistence is idempotent;
- failed or empty reads cannot erase last-known-good values;
- healing evidence is append-only;
- product identity prefers MPN/SKU, then defensible GPU/brand/VRAM identity;
- stale duplicate retailer URLs are collapsed in the catalog view, preferring
  healthy and newer state.

Migration state is guarded by `npm run db:check`. Do not hand-edit a tracked
migration or its journal without updating the deterministic migration workflow.

## 6. Self-healing

Self-healing means repairing extraction under the exact same code-owned
Collector ID, not changing downstream application code or replacing the
collector.

The retained PC Themes proof records:

- source: `pc-themes`;
- collector: `c_mt3zqdljej45v0g1r` before and after;
- initial exact-target result: 0 rows;
- healed result: 96 rows;
- valid healed result: 96 rows;
- six downstream consumer hashes unchanged.

Proof artifacts:

- `evidence/healing/pc-themes-baseline.json`
- `evidence/healing/pc-themes-proof.json`
- `evidence/healing/README.md`

The six protected downstream consumers are the source registry, refresh
orchestration, refresh route, ingestion boundary, PostgreSQL repository, and
storefront. The harness rejects secret-shaped raw artifacts, changed IDs,
off-domain URLs, malformed envelopes, unresolved required fields, unsafe output
paths, and changed hashes.

Quarantine and last-known-good preservation are reliability mechanisms, but
they are not by themselves evidence of a healed scraper.

## 7. Dynamic Country Packs

New countries can be added without a code deployment, but never directly by a
shopper or from an arbitrary URL.

The lifecycle is:

1. An authenticated operator admits a country/source/collector boundary as
   `pending`.
2. Ordered append-only evidence records eligibility, custom collector creation,
   and a successful non-empty normalized run.
3. The promotion route verifies the exact persisted identities and evidence in
   one PostgreSQL transaction.
4. The pack and source become `ready`/enabled atomically.
5. Only then does the market enter the selector and protected refresh plan; the
   next scheduled run automatically gives its source a bounded job without a
   code deployment.

Changing country, currency, source, host, URL, or Collector ID requires new
evidence. Pending or malformed packs fail closed and remain health-ledger-only.
The exact rehearsal is documented in [`operations.md`](operations.md).

## 8. Storefront behavior

The customer-facing surface provides:

- market selector with native currency isolation and immediate GET submission
  when the shopper changes country/currency;
- search by model, brand, and retailer;
- availability filters and explicit stock uncertainty;
- multi-select GPU-family and retailer filters;
- market-local sorting;
- exact observation timestamps and freshness/source-health separation;
- source-desk selection stored only in the browser;
- product detail routes and attributed retailer exits;
- data-health and methodology pages.

The homepage makes Scraper Studio integral to the first viewport with a visible
public retailer -> Scraper Studio -> validated schema -> market-local offer
trace. It uses an original light, restrained data-product system at Stripe's
craft level without copying Stripe brand assets or making Scraper Studio a
sponsor badge.

The UI must never mix currency rankings, claim checkout, hide fixture state, or
present stale/degraded rows as guaranteed offers.

## 9. Security and secrets

### Secret locations

| Secret/binding | Approved location |
| --- | --- |
| Bright Data API key | macOS Keychain service `my-api-key`; Cloudflare Worker secret `BRIGHTDATA_API_KEY` |
| Refresh HMAC | GitHub secret and Worker secret `RASTER_INGEST_HMAC_SECRET` |
| Refresh URL | GitHub secret `RASTER_REFRESH_URL` |
| PostgreSQL connection | Cloudflare Hyperdrive/VPC; not public client configuration |

Never put secret values in `.env.example`, source, issues, screenshots,
evidence, demo footage, shell arguments, or logs. Retrieve the rotated provider
key without displaying it:

```bash
raster_brightdata_key="$(security find-generic-password -s my-api-key -w)"
test "${#raster_brightdata_key}" -ge 16
printf '%s' "$raster_brightdata_key" | npx wrangler secret put BRIGHTDATA_API_KEY
unset raster_brightdata_key
```

Do not add `set -x`, `echo`, or debugging around this sequence.

### Public-data boundary

Only signed-out public retailer catalog/PDP data is allowed. Exclude private,
login-walled, paywalled, personal, restricted, government, account, cart,
checkout, review-author, contact, and payment data. Preserve canonical source
URLs and make the retailer the final authority.

## 10. Deployment and public routes

| Surface | Value |
| --- | --- |
| Worker name | `raster-gpu-market` |
| Public route | <https://abhijitmohanty.com/scrapper/> |
| Direct Worker route | <https://raster-gpu-market.spicedkopi.workers.dev/scrapper/> |
| Hyperdrive binding | `HYPERDRIVE` |
| Hyperdrive ID | `fd5e0bb46b044a1d8b8c4c5ace2a9015` |

Deploy from the `gpuverse/` root:

```bash
npx wrangler deploy --message "<bounded release description>"
```

Verify after every deployment:

```bash
curl -fsS -o /dev/null https://abhijitmohanty.com/scrapper/
curl -fsS -o /dev/null https://raster-gpu-market.spicedkopi.workers.dev/scrapper/
curl -fsS https://abhijitmohanty.com/scrapper/api/storage-health
curl -sS -o /dev/null -w '%{http_code}\n' \
  -X POST https://abhijitmohanty.com/scrapper/api/refresh \
  -H 'content-type: application/json' \
  --data '{"sourceSlugs":["pc-themes"],"role":"combined"}'
```

The first two commands must succeed, storage health must expose only the safe
hosted-PostgreSQL/private-Hyperdrive boundary, and the unsigned refresh must
return 401.

## 11. Development and verification

Required local gate:

```bash
npm test
npm run lint
npm run db:check
git diff --check
```

Current suites cover unit/security behavior, the sourcing-desk component,
PostgreSQL integration, and production server rendering. GitHub's `Raster
quality` workflow additionally checks secrets, TypeScript, deterministic
migrations, PostgreSQL, production rendering, and built/evidence artifacts.

For a live-source or release claim, local tests are insufficient. Also require:

1. exact-SHA green CI;
2. a successful signed source refresh;
3. safe Action summary inspection;
4. live browser verification of offer, retailer, model, currency, provenance,
   and fixture labels;
5. public-route, storage-health, and unsigned-auth checks;
6. updated evidence and release documents.

## 12. Last verified release snapshot

This section is historical evidence, not a promise of current state. Re-verify
before reuse.

| Item | Verified value on 2026-08-22 |
| --- | --- |
| Deployed application commit | `f22a2c6` |
| Release-document commit | `fbc2d27` |
| Worker version | `291a7e55-4b7c-4c5d-8345-a1e629511fa2` |
| Final PC Themes refresh | GitHub Actions run `32560319450` |
| Refresh result | 96 provider rows, 96 valid, 0 failures |
| Application quality run | `32560226787` |
| Release-document quality run | `32560763934` |
| Public Singapore catalog | 98 offers, 2 retailers, 0 `Unknown GPU` cards |
| Public route/storage checks | 200 / 200 / 200 |
| Unsigned refresh | 401 |

Known honest limitations at this snapshot:

- US, UK, and India remain fixture-backed.
- No cron-triggered occurrence has been separately observed.
- Dynacore and PC Themes overlap in 2 of the 3 target comparison families.
- PC Themes inventory was observed unavailable; do not call it purchase-ready.
- The user will record and publish the required demo video separately.

## 13. Documentation map

| Document | Purpose |
| --- | --- |
| `AGENTS.md` | Mandatory working rules and invariants |
| `docs/knowledge-base.md` | Durable system and operations context |
| `docs/architecture.md` | Architectural flow and boundaries |
| `docs/operations.md` | Refresh, signer, healing, and Country Pack procedures |
| `docs/security.md` | Credential and public-data baseline |
| `docs/source-eligibility.md` | Source gates, decisions, and rejection record |
| `docs/evidence-matrix.md` | Organizer expectation-to-proof index |
| `docs/qa-report.md` | Dated production QA evidence |
| `docs/demo-script.md` | Three-minute judge demo sequence |
| `docs/submission.md` | Submission gates and form copy |

## 14. Maintenance rule

Update this knowledge base in the same commit whenever any of these changes:

- a source or Collector ID is added, healed, disabled, or removed;
- a market changes between fixture, pending, ready, or live;
- API request/response behavior or authentication changes;
- tables, migrations, persistence, or Hyperdrive wiring changes;
- storefront flows or customer-facing truth labels change;
- secrets move to a different approved store;
- deployment routes, Worker identity, or verification steps change;
- new evidence supersedes the last verified snapshot.

When updating, separate durable behavior from dated observations. Never replace
an evidence link with an unsupported claim.
