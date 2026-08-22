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

Public deployment: <https://abhijitmohanty.com/scrapper/>

## Current status

Raster is deployed with a live Singapore catalog backed by the custom Dynacore
and PC Themes Scraper Studio collectors. The latest verified storefront showed
98 hosted-PostgreSQL offers across the two retailers; United States, United
Kingdom, and India remain clearly fixture-backed. The protected pipeline,
private Hyperdrive/VPC PostgreSQL schema, four-market schedule, Country Pack
contract, and same-ID healing evidence are implemented and verified by 165
unit/security tests, 1 component test, 16 PostgreSQL integration tests, and 10
production-render tests. See the maintained [Raster knowledge
base](docs/knowledge-base.md) and [master
plan](docs/plans/2026-08-21-raster-gpu-marketplace-master-plan.md).

The registry now supports four display markets: United States (USD), United
Kingdom (GBP), India (INR), and Singapore (SGD). Candidate
regional/specialist sources are listed in [docs/source-eligibility.md](docs/source-eligibility.md).
A candidate is not enabled until it is confirmed public, stable, permitted for
the intended access pattern, has same-market overlap, and is not already
covered by a Bright Data pre-built scraper. Region-specific discounts, tax, and
shipping labels remain source claims and are never silently normalized away.

Country support is registry-driven. The four baseline markets live in
`config/markets.ts`; additional countries arrive through the authenticated
Country Pack API. One pack atomically stores the country/currency definition
and a server-resolved retailer source. It remains pending until dated
eligibility, custom Collector creation, and successful run evidence exist.
Only then does it enter the selector. Shopper input can never supply a URL,
currency, or Collector ID and therefore cannot bypass the public-data gates.

## Judge-proof status

The public deployment contains the product contract, typed source registry,
protected refresh route, migrated private Hyperdrive/VPC PostgreSQL database,
append-only healing ledger, and two live Singapore sources. Dynacore collector
`c_mt3qzv5p215cci1r2e` and PC Themes collector
`c_mt3zqdljej45v0g1r` feed the production path. PC Themes has retained same-ID
healing proof from 0 rows to 96 valid rows with unchanged downstream consumer
hashes, and a manually dispatched GitHub Actions refresh has written the live
catalog. Remaining honest gates are an independently observed cron occurrence
and the 3-of-3 cross-retailer comparison-family target; current overlap is 2/3.
See the [evidence matrix](docs/evidence-matrix.md) for the dated proof boundary.

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

The storefront falls back to clearly labelled fixtures when hosted PostgreSQL is unavailable
or contains no valid rows; normalized PostgreSQL rows take over automatically through private Hyperdrive. Copy `.env.example` to
your local secret store only when a workflow explicitly needs it; never commit a
real `.env` file or paste a provider token into an issue, log, screenshot, or
demo recording.

## Collector operations

Operations are intentionally CLI-first. Live runs use the Bright Data API with
source URLs and Collector IDs resolved from the allowlisted registry, then
validate and normalize results before writing hosted PostgreSQL. Collector IDs
(`c_*`) are safe identifiers; provider credentials are not. Reuse the same
code-owned Collector ID for routine runs and healing, and retain only sanitized
evidence. Exact commands and failure handling are in
[docs/operations.md](docs/operations.md).

The release proof must include:

1. a real create-and-run flow and stable Collector IDs — verified for Dynacore
   and PC Themes;
2. at least two healthy same-currency sources and meaningful model overlap —
   two sources are live, with the explicit 3-family target currently at 2/3;
3. a scheduled or manually dispatched GitHub Actions ingestion run — manual
   production refresh verified, cron occurrence not yet independently observed;
4. one `bdata scraper heal` flow using the same Collector ID — verified for PC
   Themes from 0 to 96 valid rows;
5. a public storefront showing the normalized, dated result — verified for the
   Singapore catalog.

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

The setup key was rotated. Its replacement is stored in macOS Keychain service
`my-api-key` and the Cloudflare Worker secret `BRIGHTDATA_API_KEY`; GitHub
Actions does not receive the provider key. The public repository contains only
names, non-secret collector identifiers, and sanitized fixtures/evidence.
Review [docs/security.md](docs/security.md) before adding a provider or a
workflow. Do not add a new retailer without updating the eligibility record.

## Architecture and implementation

- [Agent instructions](AGENTS.md) — mandatory working rules and invariants.
- [Knowledge base](docs/knowledge-base.md) — maintained architecture,
  operations, deployment, evidence, and release context.
- [Architecture](docs/architecture.md) — implemented collector-to-storefront flow.
- [Source eligibility](docs/source-eligibility.md) — candidate and go/no-go
  checklist.
- [Security](docs/security.md) — secret, public-data, and refresh boundaries.
- [Operations](docs/operations.md) — scheduled/manual refresh, signing, and
  failure-safe runbook.
- [Evidence matrix](docs/evidence-matrix.md) — organizer expectation to proof.
- [Demo script](docs/demo-script.md) — terminal-first judge walkthrough.
- [Submission notes](docs/submission.md) — final release checklist.
- [Production QA](docs/qa-report.md) — automated, browser, API, PostgreSQL, and
  deployment verification evidence.
- [Rules compliance](docs/rules-compliance.md) — rule-by-rule proof ledger.
- [Structured output example](examples/structured-output.json) — safe fixture
  showing the collector contract; live evidence remains a separate release gate.
- [Country Pack templates](examples/country-pack.pending.template.json) —
  non-runnable redacted pending/ready payloads for the dynamic-country rehearsal.
- [Master plan](docs/plans/2026-08-21-raster-gpu-marketplace-master-plan.md) —
  product, technical, sequencing, and verification contract.

This project uses [vinext](https://github.com/cloudflare/vinext) on a Cloudflare
Worker with hosted PostgreSQL through a private Hyperdrive/VPC connection and Drizzle. The public portfolio origin proxies only `/scrapper/`
to the Worker, leaving all other `abhijitmohanty.com` routes untouched. Hosting
bindings are non-secret configuration; credentials remain in deployment secret
stores and never belong in this repository.
