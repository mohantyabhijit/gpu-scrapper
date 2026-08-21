# Progenix backup eligibility record

```yaml
source_slug: progenix
market: ZA
currency: ZAR
catalog_url: https://progenix.co.za/Graphics-Cards
checked_at_utc: 2026-08-21
review_method: Exa public-page fetch plus three low-rate direct HTTP probes
public_signed_out_access: pass
terms_and_robots_review: pass
bright_data_prebuilt_exclusion: pending
overlap_models:
  - model: RTX 4060 Ti
    source_sku_or_mpn: pending (public product code available on PDP)
    second_source: the-gnarly-griffin
    evidence_url: https://progenix.co.za/ASUS-DUAL-GeForce-RTX-4060-Ti-EVO-OC-Edition-8GB-GDDR6-Graphics-Card-8GB
  - model: RTX 5080
    source_sku_or_mpn: PRIME-RTX5080-O16G
    second_source: the-gnarly-griffin
    evidence_url: https://progenix.co.za/ASUS-PRIME-GeForce-RTX-5080-16GB-GDDR7-OC-EDITION-Graphics-Card-16GB
  - model: RTX 5070
    source_sku_or_mpn: GV-N5070AERO OC-12GD
    second_source: evetech
    evidence_url: https://progenix.co.za/Gigabyte-GeForce-RTX-5070-AERO-OC-12G-Graphics-Card-12GB
required_fields_observed:
  title: pass
  product_url: pass
  price: pass (ZAR amount shown)
  currency: pass (ZAR shown as R)
  availability: pass (In Stock with Supplier / Out Of Stock / Last Item in Stock)
  observed_at: pending (collector timestamp required)
  source_sku_or_mpn: pass on sampled PDPs
  board_partner_and_gpu: pass on sampled PDPs
price_semantics: displayed prices may include a documented 4% EFT discount; preserve payment mode qualifier
bounded_probe: pass_three_reads_200; repeat-read and collector probe pending
collector_roles:
  combined: pending
collector_ids:
  combined: null
  discovery: null
  pdp: null
decision: eligible_backup_candidate_pending_full_gate
notes: Robots blocks query sorting/pagination and account/cart/checkout/search surfaces, not the GPU catalog/PDP.
```

Evidence links: [GPU catalog](https://progenix.co.za/Graphics-Cards),
[robots.txt](https://progenix.co.za/robots.txt),
[terms](https://progenix.co.za/Terms-and-Conditions),
[sample RTX 5070 PDP](https://progenix.co.za/Gigabyte-GeForce-RTX-5070-AERO-OC-12G-Graphics-Card-12GB),
[sample RTX 5080 PDP](https://progenix.co.za/ASUS-PRIME-GeForce-RTX-5080-16GB-GDDR7-OC-EDITION-Graphics-Card-16GB).

The catalog is public without an account. Keep customer registration, order,
returns, and payment paths out of the collection scope, and strip any contact
or personal data if it appears beside a product row. No pre-built-library
exclusion is asserted.
