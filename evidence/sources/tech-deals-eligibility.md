# TechDeals eligibility record

```yaml
source_slug: tech-deals
market: SG
currency: SGD
catalog_url: https://www.techdeals.com.sg/collections/graphics-card-1
checked_at_utc: 2026-08-21
review_method: Exa public-page fetch plus one low-rate direct HTTP probe per public endpoint
public_signed_out_access: pass_for_public_catalog_and_sample_pdp
terms_and_robots_review: pass_with_caveat
bright_data_prebuilt_exclusion: pending
same_market_overlap:
  - model_family: RTX 5070
    source_evidence: https://www.techdeals.com.sg/products/galax-geforce-rtx-5070-1-click-oc-12gb-gddr7-192-bit-dp2-1b-3-hdmi-2-1b-dlss-4
    second_source: dynacore
    second_source_evidence: https://dynacoretech.com/products/gigabyte-geforce-rtx-5070-aorus-master-12gb-gddr7-graphics-card-rtx5070-4719331355753
  - model_family: RTX 5080
    source_evidence: https://www.techdeals.com.sg/products/zotac-rtx5080-solid-core-oc-16gb-gddr7
    second_source: dynacore
    second_source_evidence: https://dynacoretech.com/products/gigabyte-geforce-rtx-5080-aorus-master-16gb-gddr7-graphics-card-rtx5080-4719331355586
  - model_family: RTX 5090
    source_evidence: https://www.techdeals.com.sg/collections/graphics-card-1
    second_source: tradezone
    second_source_evidence: https://tradezone.sg/product/gigabyte-aorus-rtx-5090-stealth-ice-32g-graphic-card/
required_fields_observed:
  title: pass on public collection/PDP
  product_url: pass
  price: pass on public collection/PDP
  currency: pass (SGD shown as $ / explicit SGD variant price)
  availability: pass_with_caveat (Sold Out labels appear on collection rows)
  observed_at: pending (collector timestamp required)
  source_sku_or_mpn: partial (present in some product titles/URLs; collector confirmation pending)
  board_partner_and_gpu: pass on sampled public PDPs
  image_url: pending
price_semantics: current SGD listing amount; sale/original-price pairs and Sold Out labels must be retained; terms state prices may change without notice
bounded_probe: pass_one_public_catalog_read_plus_one_public_robots_and_terms_read; repeat-read pending
collector_roles:
  combined: pending
collector_ids:
  combined: null
  discovery: null
  pdp: null
decision: eligible_backup_candidate_pending_all_live_gates
notes: robots allows public catalog/product paths while excluding account/cart/checkout/admin/transactional paths. Terms were reviewed for price volatility and general site use; no authenticated access or collector permission was established.
```

Evidence links: [GPU collection](https://www.techdeals.com.sg/collections/graphics-card-1),
[robots.txt](https://www.techdeals.com.sg/robots.txt),
[terms of service](https://www.techdeals.com.sg/policies/terms-of-service),
[about page](https://www.techdeals.com.sg/pages/about-us),
[sample RTX 5070 PDP](https://www.techdeals.com.sg/products/galax-geforce-rtx-5070-1-click-oc-12gb-gddr7-192-bit-dp2-1b-3-hdmi-2-1b-dlss-4),
[sample RTX 5080 PDP](https://www.techdeals.com.sg/products/zotac-rtx5080-solid-core-oc-16gb-gddr7).

The collection is public and Singapore-local, but the evidence is not a live
collector approval. Bright Data pre-built coverage, exact overlap identity,
repeat-read stability, and any collector creation/run remain pending.
