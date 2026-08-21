# Evetech eligibility record

```yaml
source_slug: evetech
market: ZA
currency: ZAR
catalog_url: https://www.evetech.co.za/components/buy-nvidia-geforce-gtx-graphics-cards-47
checked_at_utc: 2026-08-21
review_method: Exa public-page fetch plus one low-rate direct HTTP probe
public_signed_out_access: pass
terms_and_robots_review: pass
bright_data_prebuilt_exclusion: pending
overlap_models:
  - model: RTX 4060 Ti
    source_sku_or_mpn: 912-V517-003
    second_source: the-gnarly-griffin
    evidence_url: https://www.evetech.co.za/msi-geforce-rtx-4060-ti-gaming-x-16gb/best-deal/18498
  - model: RTX 4070
    source_sku_or_mpn: pending (page exposes model; confirm MPN in collector)
    second_source: the-gnarly-griffin
    evidence_url: https://www.evetech.co.za/asus-dual-geforce-rtx-4070-oc-12gb-gddr6x/best-deal/17574
  - model: RTX 5080
    source_sku_or_mpn: 912-V531-045
    second_source: the-gnarly-griffin
    evidence_url: https://www.evetech.co.za/msi-geforce-rtx-5080-gaming-trio-16gb-white/best-deal/24748
required_fields_observed:
  title: pass
  product_url: pass
  price: partial (category/search evidence; direct PDP extraction needs collector confirmation)
  currency: partial (South African R pricing visible in public catalog/search results)
  availability: partial (public category exposes stock-oriented product paths; confirm exact enum in collector)
  observed_at: pending (collector timestamp required)
  source_sku_or_mpn: partial
  board_partner_and_gpu: pass on sampled PDPs
price_semantics: preserve current/sale amount and qualifiers such as free delivery; do not infer MSRP or VAT treatment
bounded_probe: pass_one_read_with_crawl_delay_one_second; repeat-read and collector probe pending
collector_roles:
  combined: pending
collector_ids:
  combined: null
  discovery: null
  pdp: null
decision: candidate_primary_pair_pending_full_gate
notes: robots allows public pages with Crawl-delay: 1 and blocks account/cart/checkout/API/review paths.
```

Evidence links: [GPU category](https://www.evetech.co.za/components/buy-nvidia-geforce-gtx-graphics-cards-47),
[robots.txt](https://www.evetech.co.za/robots.txt),
[terms](https://www.evetech.co.za/Company/terms-and-conditions),
[RTX 4060 Ti PDP](https://www.evetech.co.za/msi-geforce-rtx-4060-ti-gaming-x-16gb/best-deal/18498),
[RTX 4070 PDP](https://www.evetech.co.za/asus-dual-geforce-rtx-4070-oc-12gb-gddr6x/best-deal/17574),
[RTX 5080 PDP](https://www.evetech.co.za/msi-geforce-rtx-5080-gaming-trio-16gb-white/best-deal/24748).

The robots file explicitly sets a one-second crawl delay for `User-agent: *`.
The eventual collector must honor it and must not access blocked transactional,
account, API, or review paths. No pre-built-library exclusion is asserted.
