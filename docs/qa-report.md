# QA report — 2026-08-23

- Frontend ESLint: pass.
- Ranking/currency contract tests: 8 pass.
- Browser component workflow tests: 4 pass, including stale-response race protection.
- Next.js 16.3.2 production export and TypeScript: pass.
- Production dependency audit: 0 vulnerabilities.
- Backend Ruff: pass.
- Backend API/normalizer/prompt tests: 11 pass.
- Public `/scrapper/` and static assets: HTTP 200.
- Public backend health: `{"status":"ok"}`.
- PostgreSQL: 25 event rows and 3 source bindings after the live Devpost refresh.
- Public APIs: 25 deduplicated worldwide rows; US 13, IN 18, UK 17, and SG 17, each with a unique prize-ranked top ten.
- Browser: Worldwide plus all four country views render ten cards from the live API; INR, GBP, and SGD estimates appear alongside USD with no console errors.
- Mobile: 390×844 viewport has ten cards, local/USD prize signals, and no horizontal overflow.
- Release: frontend and backend symlinks point to `8070873`; `hackradar-api.service` is active and Nginx validation passes.
- GitHub quality run `32640239062`: success for exact SHA `8070873`.
- Authenticated GitHub refresh run `32636380433`: success; Devpost job completed with 3 normalized rows.

Known evidence caveats: only three of nine current Devpost rows have usable schedules; Unstop's original 18 linked rows omit prize/schedule fields and its broad repair failed safely; both UK Studio generation attempts failed before becoming runnable; the first HackRadar cron occurrence has not yet been observed.
