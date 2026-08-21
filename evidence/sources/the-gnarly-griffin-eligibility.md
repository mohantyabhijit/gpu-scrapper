# The Gnarly Griffin eligibility record

```yaml
source_slug: the-gnarly-griffin
market: ZA
currency: ZAR
catalog_url: https://thegnarlygriffin.com/collections/graphics-cards-gpus
checked_at_utc: 2026-08-21
review_method: Exa public-page fetch plus one low-rate direct HTTP probe
public_signed_out_access: pass
terms_and_robots_review: pass_with_caveat
bright_data_prebuilt_exclusion: pending
overlap_models:
  - model: RTX 4060 Ti
    source_sku_or_mpn: RTX4060TIVENTUS2X8GOCBLK
    second_source: evetech
    evidence_url: https://thegnarlygriffin.com/products/rtx4060tiventus2x8gocblk
  - model: RTX 4070
    source_sku_or_mpn: RTX4070VENTUS3X12GOC
    second_source: evetech
    evidence_url: https://thegnarlygriffin.com/products/rtx4070ventus3x12goc
  - model: RTX 5080
    source_sku_or_mpn: RTX5080VENTUS3XOCPLUS16GB
    second_source: evetech
    evidence_url: https://thegnarlygriffin.com/products/msi-geforce-rtx-5080-16g-ventus-3x-oc-plus
required_fields_observed:
  title: pass
  product_url: pass
  price: pass
  currency: pass (ZAR shown as R)
  availability: pass (In stock / Out Of Stock / Sold out)
  observed_at: pending (collector timestamp required)
  source_sku_or_mpn: pass on sampled PDPs
  board_partner_and_gpu: pass on sampled PDPs
price_semantics: regular/current public listing amount; not MSRP; stock and prices can change
bounded_probe: pass_one_read; repeat-read and collector probe pending
collector_roles:
  combined: pending
collector_ids:
  combined: null
  discovery: null
  pdp: null
decision: candidate_primary_pair_pending_full_gate
notes: Public catalog contained 51 products at review time, but only four were marked in stock; verify P0 breadth/freshness before enabling.
```

Evidence links: [catalog](https://thegnarlygriffin.com/collections/graphics-cards-gpus),
[robots.txt](https://thegnarlygriffin.com/robots.txt),
[terms](https://thegnarlygriffin.com/policies/terms-of-service),
[sample RTX 4060 Ti PDP](https://thegnarlygriffin.com/products/rtx4060tiventus2x8gocblk),
[sample RTX 4070 PDP](https://thegnarlygriffin.com/products/rtx4070ventus3x12goc),
[sample RTX 5080 PDP](https://thegnarlygriffin.com/products/msi-geforce-rtx-5080-16g-ventus-3x-oc-plus).

The robots file allows public paths and excludes private/transactional paths;
Raster must stay on catalog/PDP reads and must not enter cart, checkout,
account, or payment flows. No pre-built-library exclusion is asserted.
