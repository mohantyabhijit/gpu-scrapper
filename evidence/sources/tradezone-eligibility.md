# Tradezone SG eligibility record

```yaml
source_slug: tradezone
market: SG
currency: SGD
catalog_url: https://tradezone.sg/product-category/pc-related/pc-parts/graphic-card/
checked_at_utc: 2026-08-21
review_method: Exa public-page fetch plus one low-rate direct HTTP probe per public endpoint
public_signed_out_access: pass_for_catalog_and_terms
terms_and_robots_review: fail_intended_automated_access
bright_data_prebuilt_exclusion: pending
same_market_overlap:
  - model_family: RTX 5070
    source_evidence: https://tradezone.sg/product/asus-dual-rtx-5070-12gb-oc-edition-gaming-graphics-card/
    second_source: dynacore
    second_source_evidence: https://dynacoretech.com/products/gigabyte-geforce-rtx-5070-aorus-master-12gb-gddr7-graphics-card-rtx5070-4719331355753
  - model_family: RTX 5080
    source_evidence: https://tradezone.sg/product/gigabyte-aorus-geforce-rtx-5080-infinity-wood-16g-graphics-card/
    second_source: dynacore
    second_source_evidence: https://dynacoretech.com/products/gigabyte-geforce-rtx-5080-aorus-master-16gb-gddr7-graphics-card-rtx5080-4719331355586
  - model_family: RTX 5090
    source_evidence: https://tradezone.sg/product/gigabyte-aorus-rtx-5090-stealth-ice-32g-graphic-card/
    second_source: dynacore
    second_source_evidence: pending (exact Dynacore PDP not yet sampled)
required_fields_observed:
  title: pass on public category/PDP
  product_url: pass
  price: pass on public category/PDP
  currency: pass (SGD shown as $)
  availability: pass_with_caveat (Add to cart / Out of stock labels observed)
  observed_at: pending (collector timestamp required)
  source_sku_or_mpn: partial (category has SKU for some variant products; exact PDP coverage pending)
  board_partner_and_gpu: pass on sampled public listings
  image_url: pending
price_semantics: current SGD amount; variant products expose ranges; preserve variant selection and do not infer one exact model price from a range
bounded_probe: pass_public_read_only; no automation probe permitted after terms review
collector_roles:
  combined: blocked_pending_explicit_permission
collector_ids:
  combined: null
  discovery: null
  pdp: null
decision: stop_pending_explicit_automated_access_permission
notes: robots.txt leaves the public category/PDP paths crawlable and blocks cart/admin/log paths, but the official Terms of Use prohibit automated systems including spiders, robots, scrapers, and similar data-gathering tools. The terms gate controls the intended Raster collection path; do not create or trigger a collector without written permission or a clearly applicable approved exception.
```

Evidence links: [GPU category](https://tradezone.sg/product-category/pc-related/pc-parts/graphic-card/),
[robots.txt](https://tradezone.sg/robots.txt),
[official terms of use](https://tradezone.sg/terms-of-use/),
[sample RTX 5070 PDP](https://tradezone.sg/product/asus-dual-rtx-5070-12gb-oc-edition-gaming-graphics-card/),
[sample RTX 5080 PDP](https://tradezone.sg/product/gigabyte-aorus-geforce-rtx-5080-infinity-wood-16g-graphics-card/),
[sample RTX 5090 PDP](https://tradezone.sg/product/gigabyte-aorus-rtx-5090-stealth-ice-32g-graphic-card/).

This file records public research only. Robots permission does not cure the
terms restriction, and no Bright Data pre-built-library result, Collector ID,
or successful live run is claimed.
