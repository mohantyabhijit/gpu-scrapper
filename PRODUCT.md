# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Raster serves company buyers, procurement teams, PC builders, and researchers
who need to compare electronics listings without opening and reconciling many
retailer tabs. They use it while sourcing a specific component in a specific
market and currency.

## Product Purpose

Raster turns public retailer listings into a calm, market-local sourcing desk.
Success means a buyer can find credible candidates quickly, understand the
freshness and health of every signal, and verify the final offer at its source.

The production comparison currently centers on GPUs. RAM, Apple Mac mini, and
NVIDIA DGX Spark are being added through explicit Scraper Studio pilots and do
not enter the shopper catalog before their schemas, retailer coverage, and
non-empty runs are validated.

## Positioning

Every offer has a visible paper trail: a fixed public retailer target, a custom
Scraper Studio collector, strict market/currency validation, source health,
observed time, and the canonical retailer link. Raster preserves the last known
good catalog instead of turning a failed scrape into false freshness.

## Operating Context

- Buyers choose a market first, then compare only that market's native currency.
- Scraper Studio collectors are created for one approved public retailer target
  and repaired under the same Collector ID when markup changes.
- A protected signed refresh boundary validates and normalizes collector output
  before PostgreSQL persistence.
- Data health is a first-class judge and operator surface, not hidden plumbing.

## Capabilities and Constraints

- Four baseline views: United States/USD, United Kingdom/GBP, India/INR, and
  Singapore/SGD. Singapore is live; the other three remain disclosed fixtures.
- Search, filtering, sorting, source-desk shortlisting, product detail routes,
  retailer verification links, and a visible data-health ledger.
- Public signed-out catalog and product pages only. No accounts, personal data,
  reviews, cart, checkout, financing, payment, or restricted pages.
- No cross-market price ranking or silent currency conversion.
- Raster is not the merchant and does not guarantee price, stock, warranty, or
  compatibility.
- Pilot categories remain visible as pipeline status until separately promoted;
  shopper-facing multi-category information architecture remains an open
  release decision.

## Brand Commitments

- Product name: Raster.
- Voice: calm, exact, evidence-led, concise, and commercially credible.
- The user explicitly requested an impeccably crafted minimalist interface at
  Stripe's quality level. This is a craft and restraint benchmark, not permission
  to copy Stripe's brand, gradients, illustrations, or page composition.
- Scraper Studio must feel integral to the product rather than a sponsor badge or
  one-off build step.

## Evidence on Hand

- Live Singapore PostgreSQL catalog and two production GPU collectors.
- Same-ID PC Themes healing proof under `evidence/healing/`.
- Signed refresh, strict collector contract, quarantine, persistence, Country
  Pack, and rendered UI tests.
- RAM and Mac mini pilot state is recorded in `docs/knowledge-base.md`; DGX Spark
  evidence is pending the delegated collector run.
- No testimonials, customer logos, revenue claims, or compatibility guarantees
  are available and none may be fabricated.

## Product Principles

1. Market truth before apparent breadth.
2. Show the source and state behind every signal.
3. Preserve last-known-good data and fail visibly.
4. Keep comparison useful while stopping before commerce.
5. Earn each new category through a real collector and validated output.

## Accessibility & Inclusion

Use semantic HTML, keyboard-operable controls, visible focus, reduced-motion
support, and WCAG AA text contrast. Native currency and market labels must never
depend on color alone.
