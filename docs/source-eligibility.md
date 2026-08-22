# Source eligibility register

This is the go/no-go record for Raster’s public GPU sources. Four display
markets remain fixed: US/USD, UK/GBP, IN/INR, and SG/SGD. A source remains
disabled until its public-access, terms/robots, authenticated Bright Data,
contract, and repeat-read gates pass. The separate P0 comparison-pair gate
requires three canonical overlaps; enabling a research source does not imply
that pair-level demo threshold has passed.

## Active candidates

| Market | Source | Public catalog URL | Registry slug | Role | Decision |
| --- | --- | --- | --- | --- | --- |
| US / USD | Central Computers | <https://www.centralcomputer.com/all-products/hardware/video-cards/video-cards.html> | `central-computer` | primary | pending |
| US / USD | Micro Center | <https://www.microcenter.com/site/products/graphics-cards.aspx> | `micro-center` | secondary | pending |
| UK / GBP | Overclockers UK | <https://www.overclockers.co.uk/pc-components/graphics-cards> | `overclockers-uk` | primary | pending |
| UK / GBP | CCL Computers | <https://www.cclonline.com/pc-components/graphics-cards/> | `ccl` | secondary | pending |
| IN / INR | MDComputers | <https://mdcomputers.in/catalog/graphics-card/nvidia> | `md-computers` | primary | pending |
| IN / INR | SCL Gaming | <https://sclgaming.in/product-category/graphics-card/> | `scl-gaming` | secondary | pending |
| SG / SGD | Dynacore Technologies | <https://dynacoretech.com/collections/gpu> | `dynacore` | primary | live custom collector proven; enabled |
| SG / SGD | Infinity Computer | <https://infinitycomputer.com.sg/prices> | `infinity-computer` | secondary | live reads complete; failed numeric-price/breadth gate; disabled |
| SG / SGD | TechDeals | <https://www.techdeals.com.sg/collections/graphics-card-1> | `tech-deals` | secondary | rejected by terms; no collector |
| SG / SGD | PC Themes | <https://www.pcthemes.com.sg/video-card-graphics-card> | `pc-themes` | secondary | live custom collector and same-ID heal proven; enabled |

The Singapore P0 comparison pair remains Dynacore plus a source that clears
the validated numeric-price and overlap gates. Infinity Computer was tested as
the selected secondary candidate but its current catalog exposes only
call-for-price GPU rows to the collector, so it remains disabled. TechDeals is
rejected by its terms. PC Themes passed the authenticated pre-built exclusion,
same-ID healing, numeric-price, and repeat-read gates and is now the enabled
secondary research source. It overlaps both GPU families currently exposed by
Dynacore, so the separate three-model comparison-pair threshold remains at 2/3.
No source is enabled from unvalidated or terms-prohibited data.

## Required gates

| Gate | Evidence | Decision |
| --- | --- | --- |
| Public access | Signed-out public catalog/PDP; no login, paywall, personal data, or CAPTCHA bypass | pending per source |
| Intended access permitted | Terms and robots reviewed; reasonable rate and public paths only | pending per source |
| Bright Data coverage | Authenticated pre-built catalog checked and sanitized evidence retained | pending per source |
| P0 comparison overlap | At least three canonical GPU models overlap across the live pair | 2/3 for Dynacore + PC Themes; demo threshold pending |
| Required fields | Title, public URL, price, currency, availability, and timestamp extractable | pending per source |
| Stable identity | MPN/SKU or defensible board-partner + GPU + VRAM identity | pending per source |
| Price semantics | Cash/EFT/discount/tax labels understood and retained | pending per source |
| Operational stability | Two bounded reads succeed without excessive load | pending per source |

Robots permission alone does not establish permission to automate. A source
cannot be enabled from a public-page review, a pre-built search result, or a
placeholder ID. Collector IDs are recorded only after authenticated custom
create, successful run, sanitization, and contract validation.

## Source evidence

See the dated records for [Dynacore](../evidence/sources/dynacore-eligibility.md),
[Infinity Computer](../evidence/sources/infinity-computer-eligibility.md),
[TechDeals](../evidence/sources/tech-deals-eligibility.md), and
[PC Themes](../evidence/sources/pc-themes-eligibility.md). Infinity's live
provider state is limited to the sanitized invalid-output create/run/repeat-read
artifacts; TechDeals remains rejected. PC Themes live proof is summarized
below and in its dated eligibility record.

### PC Themes live proof — 2026-08-22

The custom collector `c_mt3zqdljej45v0g1r` initially returned zero rows from
the exact registered catalog URL. Scraper Studio healed that same Collector ID
to discover 96 public GPU PDPs, then a second same-ID refinement extracted the
numeric SGD PDP price and visible availability state. The first complete read
validated 96 of 96 rows. The repeat read validated 95 rows and quarantined one
non-GPU/empty candidate without weakening the shared contract. Both current
Dynacore GPU families (RTX 5070 and RTX 5070 Ti) overlap validated PC Themes
rows. This is every family the current Dynacore catalog exposes, but only 2/3
of the explicit P0 comparison threshold. Current PC Themes availability is out
of stock, which Raster preserves; these rows add research coverage but are not
presented as purchase-ready.

### Dynacore live proof — 2026-08-22

The current public catalog is <https://dynacoretech.com/collections/gpu>.
The signed-out page exposed two GPU products with SGD prices and canonical
product links, plus one graphics-card holder accessory. The accessory is
excluded from Raster's GPU offer set. An authenticated Bright Data Scrapers
Library search for `dynacoretech.com` returned exactly:
`This domain isn't in our library yet - but getting data from it is easy:` and
offered `Build a scraper for any website with Scraper Studio`.

The custom collector `c_mt3qzv5p215cci1r2e` was created from the registered
manifest and run twice against the exact catalog URL. Each provider read
returned three cards: two GPU rows and the graphics-card holder accessory. The
source-specific adapter rejected the accessory, mapped the provider price
objects, defaulted missing stock labels to `unknown`, and produced two rows
that passed the shared source, market, currency, URL, required-field, timestamp,
and personal-data rejection checks on both reads. Sanitized evidence is indexed
in `evidence/collectors/` and the source is enabled only under the combined
role with that same Collector ID.

### Infinity Computer live proof — 2026-08-22

The registered public target is <https://infinitycomputer.com.sg/prices>. The
authenticated Scrapers Library qualification recorded that the domain was not
in the pre-built library and was suitable for a custom Scraper Studio collector.
The public page exposes a broad mixed catalog; only cards whose category is
exactly `GPU` are in scope. The page's robots content signal does not prohibit
public reference collection, and no linked terms page was found that grants
additional automation permission.

The custom Collector ID `c_mt3snqaln8ckpnqxt` was created and run twice against
the exact registered URL. Both reads returned 678 source cards, including 59
exact-GPU cards. Every GPU card had an honest call-for-price/null price in the
provider output, so the Infinity adapter excluded 619 non-GPU cards and
quarantined all 59 GPU cards as `price_required`; zero rows passed numeric SGD
offer validation. An in-place same-ID heal timed out after 600 seconds and did
not produce a replacement read. Infinity remains disabled with an empty
registry ID, and no breadth or overlap is claimed from these rows.

## Data handling

- Retain source title, canonical public URL, source SKU/MPN, source currency,
  availability, and observation time.
- Use `unknown` for unavailable availability; never infer stock from a missing
  price. Do not silently convert or rank across currencies.
- Exclude seller contacts, reviews, accounts, cart, checkout, and personal data.
- Retailer pages remain authoritative at purchase time; Raster does not promise
  inventory, price, warranty, tax, shipping, or compatibility.

## Rejection record

| Date | Source | Decision | Reason |
| --- | --- | --- | --- |
| 2026-08-21 | Tradezone SG (`tradezone`) | reject | Official Terms of Use prohibit automated systems including spiders, robots, scrapers, and similar data-gathering tools. It is removed from the runnable registry and manifests; its public research record is retained at `evidence/sources/tradezone-eligibility.md`. |
| 2026-08-22 | TechDeals (`tech-deals`) | reject | Terms of Service prohibit spidering, crawling, scraping, automated extraction, and data-mining. It remains disabled with no Collector ID; its public research record is retained at `evidence/sources/tech-deals-eligibility.md`. |
| 2026-08-21 | ElectronicsCrazy.sg | reject | Its effective `User-agent: *` policy disallows the catalog path. |
| 2026-08-21 | Bizgram Asia | replace | Public catalog was materially older and offered weaker current-model overlap than the selected Singapore candidates. |
