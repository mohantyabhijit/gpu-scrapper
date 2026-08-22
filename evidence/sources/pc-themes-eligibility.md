# PC Themes eligibility record

```yaml
source_slug: pc-themes
market: SG
currency: SGD
catalog_url: https://www.pcthemes.com.sg/video-card-graphics-card
checked_at_utc: 2026-08-22
review_method: dated signed-out official catalog, policy, and robots review; authenticated Bright Data Dataset List API query; custom create, same-ID heals, and two post-heal reads
public_signed_out_access: pass_for_catalog_scope
terms_and_robots_review: pass_for_catalog_scope
bright_data_prebuilt_exclusion: pass_authenticated_dataset_list_api_no_domain_or_name_match_among_1743_entries
same_market_overlap:
  - model_family: RTX 5070
    source_evidence: validated live PC Themes RTX 5070 row with numeric SGD price
    second_source: dynacore
    second_source_evidence: verified live Dynacore RTX 5070 row
  - model_family: RTX 5070 Ti
    source_evidence: validated live PC Themes RTX 5070 Ti row with numeric SGD price
    second_source: dynacore
    second_source_evidence: verified live Dynacore RTX 5070 Ti row
required_fields_observed:
  title: pass
  product_url: pass
  price: pass_numeric_public_pdp_sgd
  currency: pass_sgd
  availability: pass_visible_waiting_list_out_of_stock_precedence
  observed_at: pass_provider_iso_utc
  source_sku_or_mpn: nullable_not_exposed_by_collector
  board_partner_and_gpu: pass_from_public_titles
  image_url: nullable_not_exposed_by_collector
price_semantics: pass; numeric SGD product price retained from public PDP visible/meta price fields, with retailer authoritative at purchase time
bounded_probe: pass_two_post_heal_reads_96_then_95_valid_rows
collector_roles:
  combined: live
collector_ids:
  combined: c_mt3zqdljej45v0g1r
  discovery: null
  pdp: null
decision: admitted_live_secondary_research_source_pair_overlap_gate_2_of_3
notes: The signed-out official catalog exposes numeric GPU prices, product links, images, sold-out labels, and overlapping RTX 5070/5070 Ti families. The official policy page contains shipping, exchange, refund, warranty, and price-change terms but no automated-access restriction. robots.txt returned HTTP 200 with content-signal comments and no User-agent or Disallow rule. On 2026-08-22, an authenticated GET to Bright Data's documented /datasets/list endpoint returned 1,743 available pre-built entries and no case-insensitive PC Themes, pcthemes, or Dynacore name match; only this aggregate and empty-match result was retained. Custom collector c_mt3zqdljej45v0g1r initially completed with zero rows. A same-ID discovery heal recovered 96 cards but only 19 numeric prices. A sharper same-ID PDP heal restored 96 numeric-price rows on the first read and 95 validated rows with one non-GPU quarantine on the repeat read. Both GPU families currently exposed by Dynacore, RTX 5070 and RTX 5070 Ti, overlap validated PC Themes rows; the separate three-model P0 comparison threshold therefore remains at 2/3. Sanitized run aggregates record all 96 and 95 accepted rows as out of stock; Raster preserves that state and does not present them as purchase-ready. Keep account, cart, checkout, contact, notification-email, review, and personal data out of scope.
```

This record is a dated live qualification audit. Sanitized create/run evidence
is indexed under `evidence/collectors/`; raw provider bodies remain ignored.
Public references checked on 2026-08-22:
<https://www.pcthemes.com.sg/video-card-graphics-card>,
<https://www.pcthemes.com.sg/terms>, and
<https://www.pcthemes.com.sg/robots.txt>. The authenticated library check used
Bright Data's documented `GET /datasets/list` endpoint and retained no dataset
payload or credential. Replace each `pending` value only
with a sanitized, reproducible observation from the approved CLI-first
workflow. Same-ID heal pass means the Collector ID and registered URL stayed
fixed while Scraper Studio repaired discovery and PDP extraction.
