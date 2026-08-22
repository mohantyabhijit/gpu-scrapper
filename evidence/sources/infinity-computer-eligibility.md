# Infinity Computer eligibility record

```yaml
source_slug: infinity-computer
market: SG
currency: SGD
catalog_url: https://infinitycomputer.com.sg/prices
checked_at_utc: 2026-08-22
review_method: Direct low-rate public HTTP GET of the signed-out catalog plus authenticated custom Scraper Studio create/run/repeat-read
public_signed_out_access: pass_for_public_catalog
terms_and_robots_review: pass_with_caveat
bright_data_prebuilt_exclusion: pass_authenticated_library_search_no_prebuilt_scraper
bright_data_library_result: "This domain isn't in our library yet - but getting data from it is easy:"
bright_data_next_step: "Build a scraper for any website with Scraper Studio"
public_page_findings:
  catalog_scope: category must equal GPU exactly
  catalog_reported_products: 680
  catalog_reported_gpu_cards: 59
  price_semantics: numeric SGD or honest Call for Price; no price is inferred
  robots_content_signal: "No explicit disallow for public paths; ai-train=no and use=reference"
  terms_page: no linked terms/legal page found on the public catalog
live_provider_findings:
  collector_id: c_mt3snqaln8ckpnqxt
  target_url: https://infinitycomputer.com.sg/prices
  run_01_source_cards: 678
  run_01_exact_gpu_cards: 59
  run_01_numeric_sgd_offers: 0
  run_01_price_required_quarantines: 59
  run_02_source_cards: 678
  run_02_exact_gpu_cards: 59
  run_02_numeric_sgd_offers: 0
  run_02_price_required_quarantines: 59
  same_id_heal: timeout_after_600_seconds
  accepted_offer_count: 0
required_fields_observed:
  title: pass
  product_url: pass
  price: fail_current_gpu_cards_are_call_for_price
  currency: pass_provider_market_sg
  availability: pass
  observed_at: pass_provider_scraped_at
  source_sku_or_mpn: pass
  board_partner_and_gpu: partial_provider_raw_model
  image_url: pending
price_semantics: Call for Price is retained as a quarantine reason; no numeric price is fabricated
bounded_probe: pass_two_same_id_public_reads; same_id_heal_timeout
collector_roles:
  combined: pending_invalid_output
collector_ids:
  combined: c_mt3snqaln8ckpnqxt
decision: disabled_failed_numeric_price_breadth_gate
notes: The adapter keeps only category exactly GPU, preserves provider provenance and timestamps, excludes every other category, and quarantines missing numeric prices as price_required. The stable ID is retained only in sanitized evidence; the source registry remains disabled with an empty collector ID until valid offers and overlap pass.
```

Evidence links: [public price catalog](https://infinitycomputer.com.sg/prices),
[robots.txt](https://infinitycomputer.com.sg/robots.txt). No linked terms/legal
page was found on the public catalog; no permission beyond the explicit robots
content signal is inferred.

Sanitized provider artifacts are indexed as
`infinity-computer-create-20260822.json`,
`infinity-computer-run-20260822-01.json`, and
`infinity-computer-run-20260822-02.json` under `evidence/collectors/`.
They retain only the public source binding, bounded counts, processing status,
and safe row samples. Raw provider payloads and the timed-out heal output were
removed from the exact temporary directory after validation.
