# Source eligibility register

This register is the go/no-go record for Raster’s public GPU sources. The
registry supports four display markets—United States/USD, United Kingdom/GBP,
India/INR, and Singapore/SGD—but every source is disabled
until it passes the full review below. URLs were checked as public catalog
research leads on 2026-08-21 using Exa search; they are not proof that access,
terms, or Bright Data coverage are approved.

## Candidate markets

| Market | Source | Public catalog URL | Registry slug | Role | Research signal |
| --- | --- | --- | --- | --- | --- |
| US / USD | Central Computers | <https://www.centralcomputer.com/all-products/hardware/video-cards/video-cards.html> | `central-computer` | primary | Regional specialist with a public catalog showing consumer, workstation, and accelerator cards. |
| US / USD | Micro Center | <https://www.microcenter.com/site/products/graphics-cards.aspx> | `micro-center` | secondary | Regional US retailer with public AMD/NVIDIA/Intel GPU category pages; coverage gate is especially important. |
| UK / GBP | Overclockers UK | <https://www.overclockers.co.uk/pc-components/graphics-cards> | `overclockers-uk` | primary | Public specialist category with AMD, NVIDIA, and Intel graphics cards. |
| UK / GBP | CCL Computers | <https://www.cclonline.com/pc-components/graphics-cards/> | `ccl` | secondary | Public UK category with NVIDIA, AMD, Intel, and professional GPU paths. |
| IN / INR | MDComputers | <https://mdcomputers.in/catalog/graphics-card/nvidia> | `md-computers` | primary | Public India catalog with NVIDIA series/category paths and model-level listings. |
| IN / INR | SCL Gaming | <https://sclgaming.in/product-category/graphics-card/> | `scl-gaming` | secondary | Public category with brand filters and model-level GPU listings in INR. |
| SG / SGD | Dynacore Technologies | <https://dynacoretech.com/collections/all/graphics-card> | `dynacore` | primary | Singapore specialist catalog; public GPU product pages expose model/MPN-style signals. |
| SG / SGD | ElectronicsCrazy.sg | <https://www.electronicscrazy.sg/gaming-gadgets/gaming-graphics-cards/> | `electronics-crazy` | secondary | Public Singapore gaming GPU category with brand/model paths and local fulfilment claims. |
| SG / SGD | Bizgram Asia | <https://www.bizgram.com/product-category/graphic-card/> | `bizgram` | backup | Public Singapore graphics-card category with a broad legacy/current catalog. |

These are candidates, not enabled sources. The shortlist intentionally favors
regional or specialist catalogs so Raster can satisfy the organizer’s “long
tail, not pre-built scraper” guidance. Bright Data pre-built-library exclusion
is **provisional for every row**. The authenticated Scraper Studio catalog must
be checked and the result recorded before a collector is created. If a source
is covered, replace it rather than building against the pre-built collector.

### Access verification note

A plain local `curl` probe on 2026-08-21 returned HTTP 403 for several
candidate catalogs (including Central Computers, Micro Center, Overclockers UK,
CCL, MDComputers, and SCL Gaming) while Dynacore, ElectronicsCrazy.sg, and
Bizgram returned HTTP 200. This is not an eligibility decision: bot controls can
legitimately reject a simple client while Bright Data may have an approved
collection path. It is a reason to perform bounded authenticated checks and
review terms/robots before enabling a source, not to retry aggressively.

## Registry and Collector IDs

`config/sources.ts` contains all candidates with `enabled: false` and an empty
role-keyed `collectorIds` object. The planned roles are `combined`, `discovery`,
and `pdp`; no fake or guessed `c_*` value is present. A real ID may be recorded
only after authenticated creation and a successful run, for example under the
matching `combined` role. Credentials never belong in the registry.

## Go/no-go checklist

For each source, record an execution-time row in this table or an attached
sanitized evidence file. A source cannot become enabled until every decision is
`pass`.

| Gate | Evidence to capture | Decision |
| --- | --- | --- |
| Public access | Catalog/product page loads signed out; no login, paywall, personal data, or CAPTCHA bypass | pending |
| Intended access permitted | Terms/robots and reasonable request rate reviewed | pending |
| Bright Data coverage | Authenticated pre-built catalog checked; no matching pre-built scraper | pending |
| Same-market overlap | At least three canonical GPU models overlap with another enabled source in the same currency | pending |
| Required fields | Title, public URL, price, currency, availability, and timestamp are extractable | pending |
| Stable identity | MPN/SKU or defensible board-partner + GPU + VRAM identity exists | pending |
| Price semantics | Cash/EFT/discount/tax labels are understood and retained | pending |
| Operational stability | Two bounded test reads succeed without excessive load | pending |

The initial P0 live slice may select one same-currency market, but the registry
and storefront must remain market-aware. A market should not be called healthy
until two sources have three or more overlapping canonical models and the data
contract passes on both.

## Data-handling notes

- Keep original title, canonical URL, source SKU/MPN, currency, and attribution.
- Strip or quarantine seller contact details if a page exposes them beside a
  product listing.
- Do not infer stock from a missing price. Use explicit `unknown` when the page
  does not provide a reliable availability signal.
- Preserve source currency and discount qualifiers; do not silently convert or
  rank across currencies.
- Retailer pages remain authoritative at purchase time; Raster does not promise
  inventory, price, warranty, tax, shipping, or compatibility.

## Rejection record

Record rejected or replaced candidates here with a date and a short, sanitized
reason. Do not include private correspondence or provider credentials.

| Date | Source | Decision | Reason |
| --- | --- | --- | --- |
| — | — | — | No execution-time rejection recorded yet. |
