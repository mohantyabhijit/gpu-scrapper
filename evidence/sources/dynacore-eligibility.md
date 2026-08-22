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
  availability: pass_with_caveat (collector returns unknown when the public card omits a stock label)
  observed_at: pass (ISO UTC scraped_at emitted on every accepted row)
  source_sku_or_mpn: pass_or_partial (EAN/MPN-style values in sampled URLs and PDP details)
  board_partner_and_gpu: pass on sampled PDPs
  image_url: pass (HTTPS image_url emitted on accepted rows)
price_semantics: current listing amount; sale/original-price pairs and delivery/warranty qualifiers may appear; do not treat as MSRP
bounded_probe: pass_one_public_catalog_read_plus_one_public_robots_and_terms_read; repeat-read pass_two_reads_same_collector_id_two_valid_gpu_rows_each_one_accessory_rejected
collector_roles:
  combined: pass
collector_ids:
  combined: c_mt3qzv5p215cci1r2e
  discovery: null
  pdp: null
decision: eligible_primary_live_collector_proven
collector_created_evidence: evidence/collectors/dynacore-create-20260822.json
collector_run_evidence: evidence/collectors/dynacore-run-20260822-01.json
collector_repeat_evidence: evidence/collectors/dynacore-run-20260822-02.json
notes: The signed-out collection returned two GPU products and one graphics-card holder accessory; the accessory was rejected by the source-specific adapter and is not an offer. The public page showed SGD pricing and canonical product links without requiring sign-in. Robots allows the public catalog and PDP paths while excluding account, cart, checkout, orders, admin, and policy paths. Terms state the site is for Singapore and that prices are quoted on the site, but no permission for automated extraction was established. Bright Data's authenticated library search found no pre-built scraper and offered Scraper Studio custom creation. The custom collector created as c_mt3qzv5p215cci1r2e returned three cards on each of two reads; the adapter retained two GPU rows, mapped provider price objects, defaulted missing availability to unknown, and both normalized outputs passed the shared contract validator. The source is enabled only for the registered combined role.
```

Evidence links: [GPU catalog](https://dynacoretech.com/collections/gpu),
[robots.txt](https://dynacoretech.com/robots.txt),
[terms of use](https://dynacoretech.com/pages/terms-of-use),
[sample RTX 5070 PDP](https://dynacoretech.com/products/gigabyte-geforce-rtx-5070-aorus-master-12gb-gddr7-graphics-card-rtx5070-4719331355753),
[sample RTX 5080 PDP](https://dynacoretech.com/products/gigabyte-geforce-rtx-5080-aorus-master-16gb-gddr7-graphics-card-rtx5080-4719331355586),
[sample RTX 5070 Ti PDP](https://dynacoretech.com/products/gigabyte-geforce-rtx%E2%84%A2-5070-ti-windforce-oc-sff-16g-gddr7-graphics-card-gv-n507twf3oc-16gd-4719331355579),
[excluded graphics-card holder](https://dynacoretech.com/products/asus-rog-herculx-graphics-card-holder).

The public-page review and live proof do not establish permission to access
account, cart, checkout, policy, contact, review, or personal-data paths. Keep
those paths out of scope and re-check the terms before changing the collector.
