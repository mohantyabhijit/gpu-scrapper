# Submission checklist

## P0 release gate

- [ ] Public deployment loads signed out on desktop and mobile widths.
- [ ] Two same-market sources have healthy live output and overlapping models.
- [ ] At least one real create/run flow and stable Collector ID are recorded.
- [ ] Same-ID heal is proven with sanitized before/preview/after evidence.
- [ ] Scheduled/manual GitHub Action has completed and fed D1/storefront.
- [ ] Search, filters, currency grouping, freshness, source attribution, and
      outbound links pass browser and accessibility QA.
- [ ] Last-known-good behavior is visible for a failed/stale source.
- [ ] README, architecture, evidence matrix, and demo script are current.

## Safety gate

- [ ] Exposed setup credential revoked/rotated.
- [ ] Secret scan passes working tree, history, build output, and evidence.
- [ ] No login-walled, paywalled, personal, checkout, or arbitrary URL data.
- [ ] No claims of checkout, reservation, guaranteed price, or compatibility
      advice.

## Submission package

Include the public repository, deployed URL, short demo, sanitized evidence
links, source eligibility decision, and a concise explanation of how Bright Data
Scraper Studio powers the live downstream product.
