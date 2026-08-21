# PC Themes eligibility record

```yaml
source_slug: pc-themes
market: SG
currency: SGD
catalog_url: https://www.pcthemes.com.sg/video-card-graphics-card
checked_at_utc: 2026-08-21
review_method: dated official catalog/PDP and terms/robots review; live collector work intentionally not performed
public_signed_out_access: pass_conditionally
terms_and_robots_review: pass_conditionally
bright_data_prebuilt_exclusion: pending_authenticated_check
same_market_overlap:
  - model_family: pending
    source_evidence: pending
    second_source: dynacore
    second_source_evidence: pending
  - model_family: pending
    source_evidence: pending
    second_source: tech-deals
    second_source_evidence: pending
  - model_family: pending
    source_evidence: pending
    second_source: dynacore
    second_source_evidence: pending
required_fields_observed:
  title: pending_collector_confirmation
  product_url: pass_for_public_catalog_and_pdp
  price: pending_explicit_sgd_semantics
  currency: pending_explicit_sgd_semantics
  availability: pending_rendered_stock_semantics
  observed_at: pending_collector_timestamp
  source_sku_or_mpn: pending
  board_partner_and_gpu: pending
  image_url: pending
price_semantics: pending; verify SGD display, discounts, tax, and any cash or pre-built qualifiers
bounded_probe: pending_repeat_read
collector_roles:
  combined: pending
collector_ids:
  combined: null
  discovery: null
  pdp: null
decision: backup_candidate_pending_all_live_gates
notes: Public official catalog/PDP and terms/robots review passed conditionally. Authenticated pre-built exclusion, rendered stock semantics, explicit SGD semantics, repeat-read stability, and custom collector create/run remain pending. Keep account, cart, checkout, contact, review, and personal data out of scope.
```

This record is a dated public-page audit, not evidence of a Bright Data
Collector ID or live extraction. Replace each `pending` value only with a
sanitized, reproducible observation from the approved CLI-first workflow.
