# Source eligibility register

This is the go/no-go record for Raster’s public GPU sources. Four display
markets remain fixed: US/USD, UK/GBP, IN/INR, and SG/SGD. A source remains
disabled until the full public-access, terms/robots, authenticated Bright Data,
contract, overlap, and repeat-read gates pass; Dynacore is the first source with
those live gates recorded below.

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
| SG / SGD | TechDeals | <https://www.techdeals.com.sg/collections/graphics-card-1> | `tech-deals` | secondary | pending live gates |
| SG / SGD | PC Themes | <https://www.pcthemes.com.sg/video-card-graphics-card> | `pc-themes` | backup | pending conditional review |

The Singapore P0 comparison pair is Dynacore plus TechDeals. PC Themes is the
backup candidate. TechDeals and PC Themes remain research leads; Dynacore is
runnable only through its registered combined role and proven Collector ID.

## Required gates

| Gate | Evidence | Decision |
| --- | --- | --- |
| Public access | Signed-out public catalog/PDP; no login, paywall, personal data, or CAPTCHA bypass | pending per source |
| Intended access permitted | Terms and robots reviewed; reasonable rate and public paths only | pending per source |
| Bright Data coverage | Authenticated pre-built catalog checked and sanitized evidence retained | pending per source |
| Same-market overlap | At least three canonical GPU models overlap with another admitted source | pending per source |
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
[TechDeals](../evidence/sources/tech-deals-eligibility.md), and
[PC Themes](../evidence/sources/pc-themes-eligibility.md). TechDeals and PC
Themes remain pending; Dynacore's live provider state is limited to the
sanitized create/run/repeat-read artifacts recorded in its eligibility file.

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
| 2026-08-21 | ElectronicsCrazy.sg | reject | Its effective `User-agent: *` policy disallows the catalog path. |
| 2026-08-21 | Bizgram Asia | replace | Public catalog was materially older and offered weaker current-model overlap than the selected Singapore candidates. |
