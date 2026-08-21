# Source eligibility register

This register is the go/no-go record for Raster’s public GPU sources. The
registry supports four display markets—United States/USD, United Kingdom/GBP,
India/INR, and Singapore/SGD—but every source is disabled
until it passes the full review below. URLs were checked as public catalog
research leads on 2026-08-21 using Exa search; they are not proof that access,
terms, or Bright Data coverage are approved.

## Plan-aligned P0 market review: South Africa / ZAR

The master plan names South Africa as the first-choice same-market launch. A
bounded public review on 2026-08-21 recommends **The Gnarly Griffin + Evetech**
for the P0 comparison pair, with **Progenix** retained as the third-source
backup. This is a candidate recommendation, not an enablement decision:
Bright Data's authenticated pre-built-library exclusion is still **pending**
for all three sources, and no Collector ID is asserted here.

The pair has at least three model-family overlaps visible in public pages:
RTX 4060 Ti, RTX 4070, and RTX 5080. The match is intentionally at canonical
GPU-family level until the collector returns stable board-partner/MPN fields;
the original titles, product URLs, and public SKUs must remain attached to each
row. The Gnarly Griffin currently exposes many historical/out-of-stock rows,
so the P0 run must confirm that the required breadth and freshness thresholds
are met before the source is enabled.

| Source | P0 recommendation | Signed-out / robots signal | Extractable public fields and price semantics | Bounded-probe suitability | Decision gates still open |
| --- | --- | --- | --- | --- | --- |
| [The Gnarly Griffin](https://thegnarlygriffin.com/collections/graphics-cards-gpus) | Primary pair | Catalog and `robots.txt` returned HTTP 200. `User-agent: *` allows public paths; private/admin/cart/checkout paths are disallowed. Terms describe public product prices, stock and ordering; no public catalog prohibition was found. | Collection exposes titles, ZAR prices, product links, brand/GPU filters, and explicit in-stock/sold-out labels. PDPs expose SKU, GPU, VRAM, board partner and availability; e.g. [RTX 5080 Ventus](https://thegnarlygriffin.com/products/msi-geforce-rtx-5080-16g-ventus-3x-oc-plus). Price is a regular/current listing amount, not MSRP; stock is volatile and must be timestamped. | Pass for one low-rate public catalog + robots read; repeat-read and live collector validation remain required. | Bright Data pre-built exclusion, two-read stability, and breadth/freshness threshold. |
| [Evetech](https://www.evetech.co.za/components/buy-nvidia-geforce-gtx-graphics-cards-47) | Primary pair | Catalog and `robots.txt` returned HTTP 200. `User-agent: *` allows `/` with `Crawl-delay: 1`; account, cart, checkout, API and review/write paths are disallowed. [Official terms](https://www.evetech.co.za/Company/terms-and-conditions) and pricing-change language were reviewed. | Category/PDP pages expose title, model/MPN-style text, specs and product URL; public pages cover RTX 4060 Ti, [RTX 4070](https://www.evetech.co.za/asus-dual-geforce-rtx-4070-oc-12gb-gddr6x/best-deal/17574), and [RTX 5080](https://www.evetech.co.za/msi-geforce-rtx-5080-gaming-trio-16gb-white/best-deal/24748). The site may show sale/deal/free-delivery qualifiers; preserve the displayed amount and qualifier rather than calling it MSRP. | Pass for one low-rate public catalog + robots read with the published one-second delay; current product-price/stock extraction must be confirmed by the collector. | Bright Data pre-built exclusion, exact live price/availability fields, two-read stability, and overlap confirmation. |
| [Progenix](https://progenix.co.za/Graphics-Cards) | Third-source backup | Catalog, representative PDP, and `robots.txt` returned HTTP 200. Robots disallow query sorting/pagination and account/cart/checkout/search surfaces, but not the graphics-card catalog or PDP. [Terms](https://progenix.co.za/Terms-and-Conditions) describe a public online computer retailer. | Catalog/PDPs expose titles, ZAR prices, product codes, GPU/VRAM/spec tables, and explicit “In Stock with Supplier” / “Out Of Stock” states; [RTX 5070 AERO](https://progenix.co.za/Gigabyte-GeForce-RTX-5070-AERO-OC-12G-Graphics-Card-12GB) is a current example. Progenix documents a 4% EFT discount, so the displayed price must be tagged as EFT-discounted rather than treated as a universal cash price. | Strongest backup probe: three bounded public reads returned 200; still perform a second timed catalog/PDP read before onboarding. | Bright Data pre-built exclusion, overlap with the selected pair, and price/payment-mode normalization. |

Wootware remains a researched South African candidate but is not the selected
backup in this review. Its public indexed pages show broad GPU coverage, stock
labels and ZAR prices, while a representative local probe returned HTTP 403
for both the RTX 5070 category and `robots.txt`; one PDP also explains that its
price may be hidden until a basket interaction. That is a stability and price
semantics risk for P0, not evidence that Wootware is ineligible forever. See
`evidence/sources/wootware-screening.md` for the bounded result.

### P0 evidence records

- [`evidence/sources/the-gnarly-griffin-eligibility.md`](../evidence/sources/the-gnarly-griffin-eligibility.md)
- [`evidence/sources/evetech-eligibility.md`](../evidence/sources/evetech-eligibility.md)
- [`evidence/sources/progenix-eligibility.md`](../evidence/sources/progenix-eligibility.md)
- [`evidence/sources/wootware-screening.md`](../evidence/sources/wootware-screening.md)

The evidence records are sanitized public-page notes. They do not contain
credentials, cookies, personal contact details, raw provider output, or a
claim that the Bright Data pre-built-library gate has passed.

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
| SG / SGD | Tradezone SG | <https://tradezone.sg/product-category/pc-related/pc-parts/graphic-card/> | `tradezone` | secondary | Public specialist category with 11 current GPU listings, local SGD prices, availability signals, and RTX 5070/5080/5090 overlap with Dynacore. |
| SG / SGD | TechDeals | <https://www.techdeals.com.sg/collections/graphics-card-1> | `tech-deals` | backup | Public Singapore GPU collection with current NVIDIA and AMD models, local SGD prices, stock labels, and a crawlable catalog policy. |

These are candidates, not enabled sources. The shortlist intentionally favors
regional or specialist catalogs so Raster can satisfy the organizer’s “long
tail, not pre-built scraper” guidance. Bright Data pre-built-library exclusion
is **provisional for every row**. The authenticated Scraper Studio catalog must
be checked and the result recorded before a collector is created. If a source
is covered, replace it rather than building against the pre-built collector.

### Access verification note

A bounded source review on 2026-08-21 found that Dynacore, Tradezone, and
TechDeals expose signed-out public GPU catalogs. Dynacore and TechDeals robots
policies allow their unfiltered catalog paths while excluding transactional and
account surfaces; Tradezone excludes WooCommerce logs, cart actions, and admin
paths but not the GPU category. An authenticated Bright Data pipeline-name
check returned no match for `dynacore`, `tradezone`, or `techdeals`. These are
necessary signals, not a completed collector decision: a successful custom
create/run contract and model-overlap check are still required. Several other
market candidates returned HTTP 403 to a plain local client. Bot controls can
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

## Evidence template (copy once per candidate)

Create a sanitized record such as
`evidence/sources/<source-slug>-eligibility.md` only after the source has been
reviewed. Keep the values below factual and dated; use `pending` rather than
guessing. Never paste credentials, cookies, private contact details, or raw
provider output.

```yaml
source_slug: central-computer
market: US
currency: USD
catalog_url: https://www.centralcomputer.com/all-products/hardware/video-cards/video-cards.html
checked_at_utc: YYYY-MM-DDThh:mm:ssZ
reviewer: participant
public_signed_out_access: pending
terms_and_robots_review: pending
bright_data_prebuilt_exclusion: pending
overlap_models:
  - model: pending
    source_sku_or_mpn: pending
    second_source: pending
required_fields_observed:
  title: pending
  product_url: pending
  price: pending
  currency: pending
  availability: pending
  observed_at: pending
price_semantics: pending
bounded_probe: pending
collector_roles:
  combined: pending
collector_ids:
  combined: null
  discovery: null
  pdp: null
decision: pending
notes: ""
```

Every `collector_ids` value stays `null` until a real authenticated create/run
flow returns a `c_*` ID. A pre-built-library search result is not enough: record
the authenticated check and the reason the custom collector is needed.

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
| 2026-08-21 | ElectronicsCrazy.sg | reject | Its effective `User-agent: *` policy disallows the catalog path, so Raster will not collect it. |
| 2026-08-21 | Bizgram Asia | replace | Public and crawl-delayed, but the visible catalog is materially older and offers weaker current-model overlap than Tradezone or TechDeals. |
