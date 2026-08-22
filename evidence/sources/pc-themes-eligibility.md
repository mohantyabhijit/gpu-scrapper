# PC Themes eligibility record

```yaml
source_slug: pc-themes
market: SG
currency: SGD
catalog_url: https://www.pcthemes.com.sg/video-card-graphics-card
checked_at_utc: 2026-08-22
review_method: dated signed-out official catalog, policy, and robots review plus authenticated Bright Data Dataset List API query; live collector creation in progress
public_signed_out_access: pass_for_catalog_scope
terms_and_robots_review: pass_for_catalog_scope
bright_data_prebuilt_exclusion: pass_authenticated_dataset_list_api_no_domain_or_name_match_among_1743_entries
same_market_overlap:
  - model_family: RTX 5070
    source_evidence: public PC Themes catalog titles; exact MPN match pending collector output
    second_source: dynacore
    second_source_evidence: verified live Dynacore RTX 5070 row
  - model_family: RTX 5070 Ti
    source_evidence: public PC Themes catalog titles; exact MPN match pending collector output
    second_source: dynacore
    second_source_evidence: verified live Dynacore RTX 5070 Ti row
required_fields_observed:
  title: pass_for_public_catalog_pending_collector_confirmation
  product_url: pass_for_public_catalog_and_pdp
  price: pending_explicit_sgd_semantics
  currency: pending_explicit_sgd_semantics
  availability: pass_for_public_catalog_labels_pending_collector_confirmation
  observed_at: pending_collector_timestamp
  source_sku_or_mpn: pending
  board_partner_and_gpu: pass_for_public_catalog_titles
  image_url: pass_for_public_catalog_pending_collector_confirmation
price_semantics: pending; verify SGD display, discounts, tax, and any cash or pre-built qualifiers
bounded_probe: pending_repeat_read
collector_roles:
  combined: pending
collector_ids:
  combined: null
  discovery: null
  pdp: null
decision: preferred_secondary_candidate_library_gate_passed_pending_live_collector_gates
notes: The signed-out official catalog exposes numeric GPU prices, product links, images, sold-out labels, and overlapping RTX 5070/5070 Ti families. The official policy page contains shipping, exchange, refund, warranty, and price-change terms but no automated-access restriction. robots.txt returned HTTP 200 with content-signal comments and no User-agent or Disallow rule. On 2026-08-22, an authenticated GET to Bright Data's documented /datasets/list endpoint returned 1,743 available pre-built entries and no case-insensitive PC Themes, pcthemes, or Dynacore name match; only this aggregate and empty-match result was retained. Explicit SGD semantics, exact MPN overlap, repeat-read stability, and custom collector create/run remain pending. Keep account, cart, checkout, contact, review, and personal data out of scope.
```

This record is a dated qualification audit, not evidence of a Bright Data
Collector ID or live extraction. Public references checked on 2026-08-22:
<https://www.pcthemes.com.sg/video-card-graphics-card>,
<https://www.pcthemes.com.sg/terms>, and
<https://www.pcthemes.com.sg/robots.txt>. The authenticated library check used
Bright Data's documented `GET /datasets/list` endpoint and retained no dataset
payload or credential. Replace each `pending` value only
with a sanitized, reproducible observation from the approved CLI-first
workflow.
