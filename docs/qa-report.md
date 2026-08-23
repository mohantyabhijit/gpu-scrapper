# QA report — 2026-08-23

- Frontend ESLint: pass.
- Country/ranking contract tests: 5 pass.
- Next.js 16.3.2 production export and TypeScript: pass.
- Production dependency audit: 0 vulnerabilities.
- Backend Ruff: pass.
- Backend API/normalizer/prompt tests: 8 pass.
- Public `/scrapper/` and static assets: HTTP 200.
- Public backend health: `{"status":"ok"}`.
- PostgreSQL: 25 event rows and 3 source bindings after the live Devpost refresh.
- Public APIs: 10 unique prize-ranked rows for US, IN, UK, and SG.
- Browser: country switching and AI filtering work, live API indicator visible, no console errors, accessible labels/headings present.
- Authenticated GitHub refresh run `32636380433`: success; Devpost job completed with 3 normalized rows.

Known evidence caveats: only three of nine current Devpost rows have usable schedules; Unstop's original 18 linked rows omit prize/schedule fields and its broad repair failed safely; both UK Studio generation attempts failed before becoming runnable; the first HackRadar cron occurrence has not yet been observed.
