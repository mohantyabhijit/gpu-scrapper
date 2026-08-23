# Raster architecture (implementation skeleton)

Raster keeps the operational path terminal-first and the customer surface
small. The source registry is market-aware for US/USD, UK/GBP, IN/INR, and
SG/SGD; all candidates remain disabled until the eligibility gates pass.

```text
Bright Data Scraper Studio collectors (one per eligible source)
        -> signed ready-source refresh plan
        -> one GitHub Actions job per approved source
        -> authenticated server refresh route
        -> bounded trigger/poll + contract validation
        -> normalization and quarantine
        -> Hosted PostgreSQL current offers + append-only observations via private Hyperdrive/VPC
        -> Cloudflare Worker at its isolated workers.dev origin
        -> abhijitmohanty.com/scrapper/ subpath proxy
        -> public catalog/model pages
        -> outbound retailer link (verify and buy there)
```

## Boundaries

- **Source registry:** allowlisted source slugs, public URLs, region/currency,
  role-keyed `c_*` Collector IDs, freshness target, and healing target. Never a
  credential.
- **Market boundary:** offers retain their native currency and region. Ranking
  and “best price” labels are computed only within one currency; an offer from
  one market is never numerically compared with another market’s amount without
  an explicit dated FX method.
- **Provider client:** owns Bright Data trigger/dataset calls, timeout and
  retry bounds, redaction, and provider error translation.
- **Validator/normalizer:** rejects missing/unsafe rows before persistence,
  preserves source fields, and maps defensible GPU identities.
- **PostgreSQL via private Hyperdrive/VPC:** stores current offer state, price observations, collector runs, and
  quarantine records. Replays are idempotent; failed sources preserve last good
  data.
- **Market packs:** PostgreSQL-owned country definitions are admitted pending-only.
  Append-only, identity-bound evidence records and a persisted successful
  non-empty run are required before a separate authenticated promotion
  operation atomically enables both pack and source. Only the verified ready
  boundary is merged with the four baseline markets and exposed by the selector;
  pending packs remain health-ledger-only.
- **Refresh plan:** a protected read-only query returns only a bounded,
  deterministic list of static baseline and verified runtime source slugs. The
  scheduled workflow validates that plan and creates one locked job per source;
  the runtime resolver re-checks the same ready boundary before any provider
  call, so demotion or malformed metadata fails closed.
- **Storefront:** read-only catalog, same-currency filters/sorts, freshness and
  health labels, source attribution, and safe outbound links. No checkout.
- **Public route:** the portfolio origin proxies only `/scrapper/` to Raster's
  Worker origin. The Worker keeps the `/scrapper` base path for pages, assets,
  and protected APIs; unrelated portfolio routes never enter Raster.

## Evidence surfaces

The terminal, sanitized fixtures/transcripts, GitHub Action summaries, PostgreSQL run
summary, and public storefront are the judge surfaces. The dashboard is only a
quick confirmation of collector existence or schedule state. See
[evidence-matrix.md](evidence-matrix.md).

## Open implementation decisions

- [ ] Confirm whether each candidate needs Discovery + PDP or one combined
  collector.
- [x] Provision the private Hyperdrive/VPC binding and PostgreSQL migration strategy.
- [x] Define the exact refresh HMAC and replay window.
- [x] Add the source registry, Country Pack admission path, and contract schema without credentials.
- [ ] Record the first real `c_*` ID and sanitized create/run evidence.
- [ ] Verify at least two same-market candidates and the authenticated
  pre-built-library exclusion before enabling any market.
