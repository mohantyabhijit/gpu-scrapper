# Wootware screening record (not selected for P0 backup)

```yaml
source_slug: wootware
market: ZA
currency: ZAR
catalog_url: https://www.wootware.co.za/computer-hardware/video-cards-video-devices/shopby/geforce_rtx_5070
checked_at_utc: 2026-08-21
review_method: Exa public-page research plus one low-rate direct HTTP probe
public_signed_out_access: pending
terms_and_robots_review: pending (robots endpoint returned 403 to local probe)
bright_data_prebuilt_exclusion: pending
required_fields_observed:
  title: pass (indexed public category/PDP)
  product_url: pass (indexed public category/PDP)
  price: partial (some category rows show ZAR; representative PDP hides price until basket interaction)
  currency: pass (ZAR shown on indexed rows)
  availability: pass (In stock / Supplier / Stock Coming Soon labels on indexed rows)
  observed_at: pending (collector timestamp required)
price_semantics: current price can be sale/EFT or hidden below-MSRP amount; do not use basket interaction in eligibility probe
bounded_probe: fail_local_403 (category and robots endpoint); do not retry aggressively
decision: hold_as_non_p0_candidate
notes: Indexed public pages show broad GPU coverage, but current access and price semantics are not reliable enough for the P0 backup. Revisit only with an approved public collection path and terms/robots review.
```

Evidence links: [RTX 5070 category](https://www.wootware.co.za/computer-hardware/video-cards-video-devices/shopby/geforce_rtx_5070),
[representative PDP](https://www.wootware.co.za/gigabyte-geforce-rtx-5070-windforce-oc-sff-12g-gv-n5070wf3oc-12gd-12gb-gddr7-192-bit-pcie-5-0-desktop-graphics-card.html),
[PAIA manual describing public webpages](https://www.wootware.co.za/media/wootware/PAIA_MANUAL_2021.pdf).

This is a screening note, not a rejection based on the 403 alone. The probe
only records that the local client could not establish stable public access at
review time; it does not claim that Bright Data or an authenticated browser
would receive the same response.
