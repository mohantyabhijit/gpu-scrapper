# Raster architecture (implementation skeleton)

Raster keeps the operational path terminal-first and the customer surface
small. The source registry is market-aware for US/USD, UK/GBP, IN/INR, and
SG/SGD; all candidates remain disabled until the eligibility gates pass.

```text
Bright Data Scraper Studio collectors (one per eligible source)
        -> GitHub Actions schedule/manual dispatch
        -> authenticated server refresh route
        -> bounded trigger/poll + contract validation
        -> normalization and quarantine
        -> Cloudflare D1 current offers + append-only observations
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
- **D1:** stores current offer state, price observations, collector runs, and
  quarantine records. Replays are idempotent; failed sources preserve last good
  data.
- **Storefront:** read-only catalog, same-currency filters/sorts, freshness and
  health labels, source attribution, and safe outbound links. No checkout.

## Evidence surfaces

The terminal, sanitized fixtures/transcripts, GitHub Action summaries, D1 run
summary, and public storefront are the judge surfaces. The dashboard is only a
quick confirmation of collector existence or schedule state. See
[evidence-matrix.md](evidence-matrix.md).

## Open implementation decisions

- [ ] Confirm whether each candidate needs Discovery + PDP or one combined
  collector.
- [ ] Provision D1 binding and migration strategy.
- [ ] Define the exact refresh HMAC and replay window.
- [ ] Add the source registry and contract schema without credentials.
- [ ] Record the first real `c_*` ID and sanitized create/run evidence.
- [ ] Verify at least two same-market candidates and the authenticated
  pre-built-library exclusion before enabling any market.
