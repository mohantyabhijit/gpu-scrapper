# Dynacore Technologies eligibility record

```yaml
source_slug: dynacore
market: SG
currency: SGD
catalog_url: https://dynacoretech.com/collections/gpu
checked_at_utc: 2026-08-22
review_method: Direct low-rate public HTTP GET of the signed-out collection page
public_signed_out_access: pass_for_public_catalog_and_sample_pdp
terms_and_robots_review: pass_with_caveat
bright_data_prebuilt_exclusion: pass_authenticated_library_search_no_prebuilt_scraper
bright_data_library_result: "This domain isn't in our library yet - but getting data from it is easy:"
bright_data_next_step: "Build a scraper for any website with Scraper Studio"
public_page_findings:
  - title: GIGABYTE GEFORCE RTX5070 AORUS MASTER 12GB TRIPLE FAN GDDR7 - 4719331355753
    price: "1569.00"
    currency: SGD
    product_url: https://dynacoretech.com/products/gigabyte-geforce-rtx-5070-aorus-master-12gb-gddr7-graphics-card-rtx5070-4719331355753
    classification: gpu_offer_candidate
  - title: Gigabyte GeForce RTX5070Ti WINDFORCE OC SFF 16G GDDR7 Graphics Card GV-N507TWF3OC-16GD - 4719331355579
    price: "1959.00"
    currency: SGD
    product_url: https://dynacoretech.com/products/gigabyte-geforce-rtx%E2%84%A2-5070-ti-windforce-oc-sff-16g-gddr7-graphics-card-gv-n507twf3oc-16gd-4719331355579
    classification: gpu_offer_candidate
  - title: ASUS ROG Herculx Graphics Card Holder - 195553206389
    price: "89.00"
    currency: SGD
    product_url: https://dynacoretech.com/products/asus-rog-herculx-graphics-card-holder
    classification: excluded_non_gpu_accessory
same_market_overlap:
  - model_family: RTX 5070
    source_evidence: https://dynacoretech.com/products/gigabyte-geforce-rtx-5070-aorus-master-12gb-gddr7-graphics-card-rtx5070-4719331355753
    second_source: tradezone
    second_source_evidence: https://tradezone.sg/product/asus-dual-rtx-5070-12gb-oc-edition-gaming-graphics-card/
  - model_family: RTX 5080
    source_evidence: https://dynacoretech.com/products/gigabyte-geforce-rtx-5080-aorus-master-16gb-gddr7-graphics-card-rtx5080-4719331355586
    second_source: tradezone
    second_source_evidence: https://tradezone.sg/product/gigabyte-aorus-geforce-rtx-5080-infinity-wood-16g-graphics-card/
  - model_family: RTX 5090
    source_evidence: pending (family appears in public Dynacore catalog search; exact PDP to be sampled)
    second_source: tradezone
    second_source_evidence: https://tradezone.sg/product/gigabyte-aorus-rtx-5090-stealth-ice-32g-graphic-card/
required_fields_observed:
  title: pass on sampled public PDPs
  product_url: pass
  price: pass on sampled PDPs
  currency: pass (SGD shown as $)
  availability: pass_with_caveat (Few Left / Out of stock / In Stock Unavailable labels observed)
  observed_at: pending (collector timestamp required)
  source_sku_or_mpn: pass_or_partial (EAN/MPN-style values in sampled URLs and PDP details)
  board_partner_and_gpu: pass on sampled PDPs
  image_url: pending (collector field confirmation)
price_semantics: current listing amount; sale/original-price pairs and delivery/warranty qualifiers may appear; do not treat as MSRP
bounded_probe: pass_one_public_catalog_read_plus_one_public_robots_and_terms_read; repeat-read pending
collector_roles:
  combined: pending
collector_ids:
  combined: null
  discovery: null
  pdp: null
decision: candidate_primary_pending_all_live_gates
notes: The signed-out collection returned two GPU products and one graphics-card holder accessory; the accessory is excluded and is not an offer. The public page showed SGD pricing and canonical product links without requiring sign-in. Robots allows the public catalog and PDP paths while excluding account, cart, checkout, orders, admin, and policy paths. Terms state the site is for Singapore and that prices are quoted on the site, but no permission for automated extraction was established. Bright Data's authenticated library search found no pre-built scraper and offered Scraper Studio custom creation. Keep the source disabled and collector IDs empty until Task 2 completes.
```

Evidence links: [GPU catalog](https://dynacoretech.com/collections/gpu),
[robots.txt](https://dynacoretech.com/robots.txt),
[terms of use](https://dynacoretech.com/pages/terms-of-use),
[sample RTX 5070 PDP](https://dynacoretech.com/products/gigabyte-geforce-rtx-5070-aorus-master-12gb-gddr7-graphics-card-rtx5070-4719331355753),
[sample RTX 5080 PDP](https://dynacoretech.com/products/gigabyte-geforce-rtx-5080-aorus-master-16gb-gddr7-graphics-card-rtx5080-4719331355586),
[sample RTX 5070 Ti PDP](https://dynacoretech.com/products/gigabyte-geforce-rtx%E2%84%A2-5070-ti-windforce-oc-sff-16g-gddr7-graphics-card-gv-n507twf3oc-16gd-4719331355579),
[excluded graphics-card holder](https://dynacoretech.com/products/asus-rog-herculx-graphics-card-holder).

The public page review does not prove Bright Data coverage, collector
creation, successful live extraction, two-read stability, or permission to
automate. Keep all account, cart, checkout, and policy paths out of scope and
re-check the terms before creating any collector.
