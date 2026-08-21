# Raster GPU Marketplace

Raster is “the GPU market without the tab circus”: an ecommerce-style comparison
site that turns public GPU listings from regional retailers into dated,
normalized offers. It helps a shopper compare and then hands off to the
original retailer. Raster is not the merchant: it does not process payment,
reserve inventory, or guarantee a price.

The project is being built for WeMakeDevs’ Into the Scrape-Verse hackathon. The
Bright Data Scraper Studio collector, terminal-first operations, scheduled
ingestion, and same-Collector-ID healing are part of the product proof—not a
private implementation detail.

Repository: <https://github.com/mohantyabhijit/gpu-scrapper>

## Current status

This repository is at the safe implementation baseline. The authoritative
execution plan is [the Raster master plan](docs/plans/2026-08-21-raster-gpu-marketplace-master-plan.md).
Live source eligibility must be verified immediately before creating collectors;
the candidate list is documented in [docs/source-eligibility.md](docs/source-eligibility.md).

The registry now supports four display markets: United States (USD), United
Kingdom (GBP), India (INR), and Singapore (SGD). Candidate
regional/specialist sources are listed in [docs/source-eligibility.md](docs/source-eligibility.md).
A candidate is not enabled until it is confirmed public, stable, permitted for
the intended access pattern, has same-market overlap, and is not already
covered by a Bright Data pre-built scraper. Region-specific discounts, tax, and
shipping labels remain source claims and are never silently normalized away.

Country support is registry-driven. `config/markets.ts` is the single source of
truth for route slugs, country codes, local currencies, formatting, and the
selector. A new country becomes visible after an operator adds its market
definition, approves at least one public source in `config/sources.ts`, and
passes the collector contract. Raster never accepts arbitrary runtime countries
or currencies that could bypass the source and public-data gates.

## Judge-proof status

The public repository currently contains the product contract, fixture-backed
market experience, typed source registry, protected-refresh design, and QA
scaffolding. Live custom Collector IDs, authenticated source eligibility,
deployed D1 writes, same-ID healing, and a verified scheduled run remain
release gates. They are intentionally marked `pending` in the
[evidence matrix](docs/evidence-matrix.md); do not describe fixtures as live
Scraper Studio output in the submission or video.

## Product boundary and data policy

- Public catalog/product pages only. No login-walled, paywalled, personal, or
  private data, CAPTCHA bypass, checkout, or account scraping.
- Every offer keeps its retailer URL, source title, currency, availability, and
  observation time. Shoppers must verify the offer at the retailer.
- Same-currency ranking only. Raster never calls a nominally smaller amount in
  another currency the global “cheapest” offer.
- Failed runs preserve the last known good observation and mark the source
  degraded or stale; fixtures are clearly labelled when used for a demo.
- Product identity is a comparison aid, not a compatibility or safety claim.

## Local development

Prerequisite: Node.js `>=22.13.0`.

```bash
npm ci
npm run dev
```

Useful quality gates:

```bash
npm run lint
npm run build
npm test
npm run db:generate
```

The current starter runs with fixture/local behavior. D1 and live collection
are added through the implementation units in the plan. Copy `.env.example` to
your local secret store only when a workflow explicitly needs it; never commit a
real `.env` file or paste a provider token into an issue, log, screenshot, or
demo recording.

## Collector operations

Operations are intentionally CLI-first. A future live run will use the Bright
Data CLI/API with source URLs from an allowlisted registry, then validate and
normalize results before writing D1. Collector IDs (`c_*`) are safe identifiers;
provider credentials are not. The README will be updated with the exact
redacted create/run/heal transcript after a real collector is created.

The release proof must include:

1. a real create-and-run flow and a stable Collector ID;
2. at least two healthy same-currency sources and meaningful model overlap;
3. a scheduled or manually dispatched GitHub Actions ingestion run;
4. one `bdata scraper heal` preview/approval/rerun using the same Collector ID;
5. a public storefront showing the normalized, dated result.

See [docs/evidence-matrix.md](docs/evidence-matrix.md) and
[docs/demo-script.md](docs/demo-script.md) for the judge-facing checklist.

## AI-assistant disclosure

This project is built with Codex and multiple GPT-5.6 Luna subagents for scoped
research, data-contract work, UI implementation, automation, and QA. The human
participant sets the product direction and source markets, reviews the plans and
organizer constraints, decides what ships, supplies/rotates credentials through
approved secret stores, and must understand and explain the final code. AI
output is not accepted as proof: behavior is verified with tests, migrations,
browser/accessibility checks, secret scans, public Git history, and live
Scraper Studio evidence.

## Secrets and contributions

The Bright Data key previously shared during setup is treated as exposed and
must be revoked/rotated before any live collection. Store the replacement only
in local secure storage, deployment secrets, or GitHub Actions secrets. The
public repository must contain names-only placeholders and sanitized fixtures.
Review [docs/security.md](docs/security.md) before adding a provider or a
workflow. Do not add a new retailer without updating the eligibility record.

## Architecture and implementation

- [Architecture](docs/architecture.md) — planned collector-to-storefront flow.
- [Source eligibility](docs/source-eligibility.md) — candidate and go/no-go
  checklist.
- [Security](docs/security.md) — secret, public-data, and refresh boundaries.
- [Operations](docs/operations.md) — scheduled/manual refresh, signing, and
  failure-safe runbook.
- [Evidence matrix](docs/evidence-matrix.md) — organizer expectation to proof.
- [Demo script](docs/demo-script.md) — terminal-first judge walkthrough.
- [Submission notes](docs/submission.md) — final release checklist.
- [Rules compliance](docs/rules-compliance.md) — rule-by-rule proof ledger.
- [Structured output example](examples/structured-output.json) — safe fixture
  showing the collector contract; live evidence remains a separate release gate.
- [Master plan](docs/plans/2026-08-21-raster-gpu-marketplace-master-plan.md) —
  product, technical, sequencing, and verification contract.

This project uses [vinext](https://github.com/cloudflare/vinext) with optional
Cloudflare D1/Drizzle support. Hosting bindings are configured separately from
the public source; no deployment credential belongs in this repository.
