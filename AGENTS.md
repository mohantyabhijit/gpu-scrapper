# Raster agent notes

## Start here

- Read [`docs/knowledge-base.md`](docs/knowledge-base.md) before changing the
  scraper pipeline, database, storefront, deployment, evidence, or release
  claims.
- Update the knowledge base in the same commit whenever architecture, APIs,
  collectors, source status, persistence, deployment, security handling, or
  verified production behavior changes.
- Treat `docs/knowledge-base.md` as durable operational context and the dated
  evidence files as proof. Re-check live state before making a current claim.

## Product contract

Raster is a read-only GPU sourcing and market-intelligence storefront for
company buyers. It normalizes public specialist-retailer listings, keeps every
comparison market-local, exposes provenance and freshness, and sends purchase
decisions back to the retailer. It is not a merchant and has no checkout.

The four baseline markets are US/USD, UK/GBP, IN/INR, and SG/SGD. Only
Singapore currently has verified live inventory. US, UK, and India are
fixture-backed until their sources pass the full live-source gates. Never call
a fixture, configured source, or pending Country Pack live.

## Bright Data collectors

Use these code-owned Singapore bindings:

| Source | Slug | Collector ID | Registered public target |
| --- | --- | --- | --- |
| Dynacore Technologies | `dynacore` | `c_mt3qzv5p215cci1r2e` | `https://dynacoretech.com/collections/gpu` |
| PC Themes | `pc-themes` | `c_mt3zqdljej45v0g1r` | `https://www.pcthemes.com.sg/video-card-graphics-card` |

- Reuse the same Collector ID for routine runs and repairs. Do not create a
  replacement merely because extraction broke.
- Never use the parent SecondSpin collector `c_mt2nbsqd1akac96fiz` here.
- A collector may run only against its registry-owned URL/host and declared
  market/currency. Shopper input may never provide a URL or Collector ID.
- PC Themes is the retained self-healing proof: the same collector recovered
  from 0 rows to 96 valid rows while the six downstream consumer hashes stayed
  unchanged. The proof is bounded; do not promise universal healing.

## Secrets

- The rotated Bright Data credential lives in macOS Keychain service
  `my-api-key` and in the Cloudflare Worker secret `BRIGHTDATA_API_KEY`.
- Never print, paste, persist, commit, screenshot, log, or place the key in a
  command argument. Retrieve it only into a short-lived, task-specific shell
  variable and pipe it to the secret consumer, then unset it.
- The refresh workflow uses `RASTER_REFRESH_URL` and
  `RASTER_INGEST_HMAC_SECRET`; GitHub Actions must not receive the Bright Data
  provider key.
- Collector IDs and Hyperdrive IDs are non-secret identifiers. API keys, HMAC
  values, bearer tokens, cookies, signed URLs, raw authorization headers, and
  unrestricted provider bodies are secret.
- Before every push, rely on the repository secret scan and inspect any new
  evidence artifact for credential-shaped content.

## Public-data boundary

- Scrape signed-out public catalog and product pages only.
- Do not collect login-protected, private, paywalled, personal, restricted,
  government, account, cart, checkout, review-author, or seller-contact data.
- Respect source terms and robots review. A reachable page alone is not an
  approval to automate it.
- Preserve canonical source URLs and observed timestamps. Treat price, stock,
  warranty, tax, shipping, and compatibility as retailer claims that users must
  verify at the source.
- Never infer availability from missing price data or compare numeric prices
  across currencies.

## Architecture invariants

- Flow: Scraper Studio -> signed refresh -> bounded trigger/poll -> adaptation
  and validation -> normalization/quarantine -> hosted PostgreSQL through
  private Hyperdrive -> read-only storefront.
- `config/sources.ts` owns approved baseline source bindings. PostgreSQL owns
  promoted runtime Country Packs. Both fail closed.
- Hosted PostgreSQL is the only production persistence path. Do not reintroduce
  D1 or a public database connection.
- Valid refreshes must be non-empty. Invalid or empty output cannot replace
  last-known-good offers.
- Refresh requests are HMAC-authenticated, replay-protected, rate-limited,
  allowlisted by source slug, and never accept arbitrary URLs.
- Country Packs enter as pending and remain invisible to shoppers until ordered
  eligibility, collector, and successful-run evidence permits an atomic ready
  promotion.
- Storefront reads stay market/currency isolated, provenance-first, and
  checkout-free.

## Development and repository hygiene

- Preserve unrelated user changes. In particular, do not stage, rewrite, or
  revert a dirty `README.md` unless the user explicitly asks.
- Use focused commits and push completed work to both
  `codex/raster-gpu-marketplace` and `main` when authorized by the user.
- Keep raw provider material under ignored `evidence/raw/`; commit only
  sanitized, bounded evidence.
- Use `apply_patch` for hand-edited files. Run `git diff --check` before commit.
- When implementation behavior changes, update the relevant release docs and
  [`docs/knowledge-base.md`](docs/knowledge-base.md) in the same change.

## Required verification

Run from the `gpuverse/` root:

```bash
npm test
npm run lint
npm run db:check
git diff --check
```

For deployment-affecting work also verify:

- the GitHub `Raster quality` workflow is green for the exact pushed SHA;
- `https://abhijitmohanty.com/scrapper/` and the direct Worker route return 200;
- `/scrapper/api/storage-health` returns the sanitized PostgreSQL/Hyperdrive
  health boundary;
- unsigned `POST /scrapper/api/refresh` returns 401;
- a signed, source-bounded refresh succeeds before claiming live inventory;
- browser QA confirms the actual offer/retailer/model counts and no fabricated
  live state.

## Deployment

- Worker: `raster-gpu-market`.
- Public path: `https://abhijitmohanty.com/scrapper/`.
- Direct origin: `https://raster-gpu-market.spicedkopi.workers.dev/scrapper/`.
- PostgreSQL reaches the Worker only through Hyperdrive binding `HYPERDRIVE`
  with ID `fd5e0bb46b044a1d8b8c4c5ace2a9015`.
- Deploy from `gpuverse/` with `npx wrangler deploy --message "<bounded change>"`.
  A successful upload is not sufficient: record the Worker version and verify
  both public routes.

## Evidence and release honesty

- Current dated evidence is summarized in `docs/evidence-matrix.md`,
  `docs/qa-report.md`, and `docs/source-eligibility.md`.
- Keep the known limitations explicit: only Singapore is live; the configured
  cron has not yet been observed firing; Dynacore and PC Themes cover 2 of the
  3 target comparison families; PC Themes offers were observed unavailable.
- Do not call a manual workflow run a cron occurrence.
- Do not call quarantine or last-known-good behavior self-healing. The healing
  claim requires the retained same-ID before/after proof.
- Never expose secrets or raw provider output in issues, evidence, screenshots,
  submissions, or the demo video.
