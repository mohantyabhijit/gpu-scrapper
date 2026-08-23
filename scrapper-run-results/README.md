# Scraper run results

This directory publishes the sanitized evidence behind HackRadar's scraper and self-healing claims. It contains preserved before/after outputs, Bright Data Studio receipts, validation summaries, safe failure evidence, and the earlier Raster/GPU collection history.

The source captures remain under ignored `evidence/raw/`. These judge-facing copies remove verbose descriptions, eligibility text, provider response IDs, input envelopes, contact and registration material, and other data that is not needed to verify the result. Collector IDs, public source URLs, repair prompts, completed workflow steps, output schemas, counts, and public product/event rows are retained.

## HackRadar: Devpost same-ID healing

Collector: [`c_mt5n8l0w1kcr7uzxre`](https://brightdata.com/cp/scrapers/c_mt5n8l0w1kcr7uzxre)

| Stage | Published evidence | What it proves |
| --- | --- | --- |
| Broken baseline | [`devpost/01-baseline-empty-records.json`](devpost/01-baseline-empty-records.json) | The completed run returned nine records and every `hackathons` array was empty. |
| First heal | [`devpost/02-first-heal-receipt.json`](devpost/02-first-heal-receipt.json) | Bright Data finished a 17-step repair against the same collector. |
| First rerun | [`devpost/03-first-healed-run.json`](devpost/03-first-healed-run.json) | The collector returned nine flat event rows. |
| Second heal | [`devpost/04-second-heal-receipt.json`](devpost/04-second-heal-receipt.json) | Bright Data finished a 10-step repair for prizes, dates, and country fields. |
| Final rerun | [`devpost/05-final-healed-run.json`](devpost/05-final-healed-run.json) | The same collector returned the enriched flat model. |
| Reconciliation | [`devpost/06-validation-summary.json`](devpost/06-validation-summary.json) | Nine final rows, eight prize claims, three complete schedules, and three production-accepted rows. |

This demonstrates operator-initiated same-ID recovery. It does not claim that drift detection, repair approval, and rerunning were fully unattended.

## Other HackRadar collectors

- [`unstop/`](unstop/) preserves the India collector creation receipt, its 18 sanitized linked results, and the later repair failure that left the last-known-good data intact.
- [`uk/`](uk/) preserves the initial collector failure, failed same-ID heal, and failed replacement attempt. These IDs are evidence only and are not presented as ready collectors.
- [`luma/attempts.json`](luma/attempts.json) records the two failed Studio attempts and the decision to use the bounded public JSON-LD fallback.
- [`wemakedevs/01-listing-results.json`](wemakedevs/01-listing-results.json) publishes the four current/ongoing public cards accepted by the independent WeMakeDevs adapter on 2026-08-24.

## Production verification

- [Successful authenticated refresh](https://github.com/mohantyabhijit/hackathon-scrapper/actions/runs/32636380433)
- [Public source registry](https://abhijitmohanty.com/scrapper-api/sources)
- [Live HackRadar product](https://abhijitmohanty.com/scrapper/)

## Historical Raster/GPU evidence

The earlier product direction is retained separately under [`raster-gpu/`](raster-gpu/). It is historical evidence, not the current HackRadar runtime.
