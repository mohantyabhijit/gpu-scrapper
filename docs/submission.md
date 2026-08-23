# HackRadar submission draft

## Project description

HackRadar is a country-aware prize map for frequent hackathon builders. It ranks a top ten for the USA, India, UK, and Singapore, then annotates each opportunity with category, original source, schedule, deadline, mode, prize claim, and realistic effort band. A playful Next.js and Three.js interface makes exploration fast; a Python data service keeps the underlying model stable as public event sites change.

## How Scraper Studio is used

Scraper Studio is the collection and recovery layer, not a one-time data import. Custom collectors cover Devpost, Unstop, and Hackathons UK public pages. FastAPI triggers and polls the collectors, compares output with a fixed event schema, normalizes valid rows into PostgreSQL, and preserves the last-known-good records when output is empty or drifted.

Devpost demonstrates same-ID self-healing: its initial run returned nested empty arrays. Two targeted `bdata scraper heal` passes retained Collector ID `c_mt5n8l0w1kcr7uzxre`, produced nine flat event rows with the complete key set and eight disclosed prize values, and yielded three rows with schedules strict enough to normalize. The weak rows are rejected rather than fabricated.

HackRadar can also write a new collector from a prompt. An authenticated operator supplies a public source and goal; GPT produces a bounded Studio prompt containing the exact runtime schema, and the CLI creates the collector. A live Keychain-backed GPT test plus a regression test verified the exact fields and Studio's 500-character creation limit. The UK attempt reached Studio and received a stable ID, but provider generation failed before runnable output, so it is disclosed as pipeline evidence rather than a working source.

## Why it matters

Directories optimize for volume. A repeat builder needs a decision: what is open to me, what is the upside, and can I actually finish it? HackRadar combines country eligibility, ranking, category, effort, and provenance in one surface while making scraper health an explicit product capability.

## Links

- Product: <https://abhijitmohanty.com/scrapper/>
- Repository: <https://github.com/mohantyabhijit/hackathon-scrapper>

## Honest completion notes

The production API currently serves 22 normalized, source-linked records and a unique top ten for each market. Current Devpost live output only has three schedule-complete rows, so verified seed records remain part of the last-known-good dataset. Unstop's original collector remains runnable but degraded after a broader repair failed safely. Both UK Studio generation attempts failed before a runnable template existed. An authenticated GitHub dispatch successfully refreshed Devpost and wrote three rows; a daily cron is configured, but its first HackRadar schedule occurrence must be observed separately.

Subjective CLI ratings and the final legal/submission attestations must be confirmed and submitted by the participant.
