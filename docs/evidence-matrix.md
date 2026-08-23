# Submission evidence matrix

| Claim | Evidence | State on 2026-08-23 |
| --- | --- | --- |
| Public working product | `/scrapper/`, browser interaction pass | Verified live |
| Four country top tens | Frontend tests + four public API queries | 10 unique rows each |
| Real database | PostgreSQL count + API responses | 25 normalized rows after live refresh |
| Next.js + Three.js frontend | `app/`, `components/orbit-scene.tsx`, production build | Verified |
| Python backend | `backend/src/hackradar`, Ruff and pytest | Verified |
| Studio collector creation | three collector IDs, ignored raw envelopes | Verified with caveats |
| Same-ID self-healing | Devpost repair and exact-target rerun | 9 flat rows; 3 normalize |
| Failed-heal safety | Unstop same-ID repair envelope | Repair failed; original collector remained unchanged and runnable |
| AI-authored collector prompt | Keychain-backed live GPT call + UK Studio creation attempt | Exact schema/500-char boundary verified; Studio created an ID then failed before runnable output |
| Drift safety | refresh service/tests, last-known-good database model | Verified in code/tests |
| Authenticated refresh | GitHub Actions run `32636380433` | Manual production dispatch succeeded; Devpost wrote 3 rows |
| Scheduled refresh | `.github/workflows/collect.yml`, repo secrets | Daily cron configured; first HackRadar cron occurrence not yet observed |
| Secret safety | Keychain/systemd secret stores, GitHub scan | Values not committed |
| Main push and CI | GitHub `main`, required `verify` workflow | `68f77aa` passed; re-check final SHA before submission |

Provider completion and public deployment are separate gates. State exact counts and dates when presenting this table.
