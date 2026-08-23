# HackRadar agent notes

These instructions apply to this repository. The current product is HackRadar; older Raster GPU work remains in Git history and historical evidence only.

## Shipping contract

- Frontend: Next.js + Three.js at `https://abhijitmohanty.com/scrapper/`.
- Backend: FastAPI at `/scrapper-api/`, PostgreSQL, Bright Data Studio/API/CLI, OpenAI prompt generation.
- Supported participant countries: `US`, `IN`, `UK`, `SG`.
- Update `docs/knowledge-base.md` in the same commit whenever architecture, collector bindings, schemas, deployment, or operational behavior changes.
- Finish the loop by default: test, commit, push `main`, deploy, and verify public routes. Never equate a push with a deployment.

## Collector bindings

- Devpost global: `c_mt5n8l0w1kcr7uzxre`.
- Unstop India: `c_mt5n8mon1lgz9hhuoe`.
- Hackathons UK initial failed generation: `c_mt5n8jd5y2gdnzt5p`; it is not runnable and must not be called healed or ready.
- GPT-authored Hackathons UK replacement attempt: `c_mt5pvcq9238pirddsq`; Studio failed during intent analysis, so this half-built ID is evidence only and is not a production binding.
- Luma city-listing attempt: `c_mt5ylasf26gxfk0wx6`; Studio never produced a template.
- Luma event-detail attempt: `c_mt5z2whq2q1we2xpeh`; its exact-target run was empty and its incorrect heal was rejected. It is evidence only, not a production binding.
- Never reuse SecondSpin collector `c_mt2nbsqd1akac96fiz` or any historical GPU collector.

Reuse a runnable collector ID for routine runs and healing. Create a replacement only when Studio never produced a runnable template, and document the reason and new ID. Do not create another UK replacement until the two provider-side generation failures have been inspected.

Luma uses the deterministic Python JSON-LD fallback under `backend/src/hackradar/services/luma.py` because both Studio attempts failed validation. Its allowlisted markets are San Francisco and New York for the US, London for the UK, Bengaluru and Mumbai for India, and Singapore. Do not broaden the target set or collect attendee identities, personal profiles, street addresses, hidden venues, or registration-form data.

## Safety

- Public signed-out event pages only; no login, account, application, private, personal, paywalled, restricted, CAPTCHA-bypass, or government pages.
- Preserve source URLs and last-known-good rows. Do not invent dates, prizes, or eligibility.
- Keep credentials in Keychain or production secret files. Never print or commit values, authorization headers, raw provider responses, production URLs containing credentials, or personal data.
- Raw Studio output stays under ignored `evidence/raw/`; commit only sanitized counts and schema evidence.
