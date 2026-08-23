# QA report — 2026-08-24

- Frontend ESLint: pass.
- Ranking/currency contract tests: 8 pass.
- Browser component workflow tests: 7 pass, including stale-response race protection.
- Next.js 16.3.2 production export and TypeScript: pass.
- Production dependency audit: 0 vulnerabilities.
- Backend Ruff: pass.
- Backend API/normalizer/prompt tests: 19 pass, including the Studio-discovery enrichment boundary.
- Public `/scrapper/` and static assets: HTTP 200.
- Public backend health: `{"status":"ok"}`.
- WeMakeDevs production refresh job `55ce619889c94b2b8a7e7f890c5fcf0d`: completed with 4 normalized rows; source state is `ready`.
- WeMakeDevs Studio production refresh job `95bf4c4b9b954088ae135e7d5c0de0e1`: completed with collector `c_mt61hvcq1d8np500ya`, 4 normalized rows, and pipeline `scraper-studio+public-card-enrichment`.
- Public APIs: 40 deduplicated worldwide rows; US 20, IN 27, UK 23, and SG 22. All four WeMakeDevs rows are eligible in each supported country feed.
- Browser: Worldwide plus all four country views render ten cards from the live API; INR, GBP, and SGD estimates appear alongside USD with no console errors.
- Mobile: 390×844 viewport has ten cards, local/USD prize signals, and no horizontal overflow.
- Release: frontend symlink points to `8a230dbe378d4e4fd707544937891c6ea0018a34`, backend symlink points to `e9c2439`, and `hackradar-api.service` is active.
- GitHub quality run `32652525100`: success for exact SHA `32d34fe2327a848e055734be575e21b94b224066`.
- Authenticated GitHub refresh run `32636380433`: success; Devpost job completed with 3 normalized rows.

Known evidence caveats: only three of nine current Devpost rows have usable schedules; Unstop's original 18 linked rows omit prize/schedule fields and its broad repair failed safely; both UK Studio generation attempts failed before becoming runnable. WeMakeDevs now has a separate Studio collector, but its raw generic extraction still needs bounded same-page enrichment for clean titles and complete contract fields; a regressive repair preview was rejected.
