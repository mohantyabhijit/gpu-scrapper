# Hackathon rules compliance ledger

This ledger maps the organizer rules supplied on 2026-08-21 to release evidence.
`pending` is intentional: no item becomes `pass` until its proof exists.

| Rule | Raster compliance | Evidence | Status |
| --- | --- | --- | --- |
| Eligible participation | Participant location/registration must be confirmed by the participant. | registration confirmation | participant gate |
| One team, 1–4 people | Team membership must be confirmed before the form is filled. | official form | participant gate |
| Required technology | Create and run at least one custom Bright Data Scraper Studio scraper. | stable `c_*` create/run/repeat-read evidence | Dynacore proven; downstream route pending |
| Open-ended useful project | Raster is a four-market GPU comparison and reliability pipeline. | public app and README | pass |
| No library-only entry | Enabled sources must use custom Scraper Studio collectors; pre-built coverage is an exclusion gate. | source register and collector evidence | Dynacore custom collector and exclusion proven |
| Public data only | No private, login-protected, paywalled, personal, or restricted data. | source eligibility and security review | pending |
| No government sites | Registry contains only public retailer candidates. | `config/sources.ts` | pass |
| Work began during event | Public history begins during the event; participant must be able to explain any earlier notes/templates. | git history and issue #1 | pending |
| Third-party tools allowed | Dependencies/assets are identified and original hackathon work is visible in history. | lockfile, LICENSE, git log | in progress |
| Required package | Public repo, clear README, structured output example, working demo video, and Scraper Studio explanation. | release checklist below | pending |
| AI disclosure | README and submission identify Codex and Luna subagents and describe participant verification. | README and demo | README pass; video pending |
| Participant understanding | Demo and docs explain scraper, contracts, architecture, and technical decisions. | architecture, demo script, Q&A rehearsal | pending |
| Meaningful contribution | Participant directs scope, market choices, tradeoffs, QA, and final approvals; AI output is reviewed and tested. | issue/comments, commits, QA evidence | in progress |
| Prize allocation | Enter Web-Slinger, Suit-Up, and Spider-Sense with the organizer's team-prize semantics. | official form | pending |
| Raffle/Daily Bugle | LinkedIn entry is optional and must be a real public post by its author tagging WeMakeDevs. | participant-provided link | optional |
| Intellectual property | Project code remains owned by the participant/team; team ownership agreement is a participant gate. | repository/license and team confirmation | participant gate |
| Respect/code of conduct | Follow the WeMakeDevs Code of Conduct. | participant attestation | participant gate |
| No misconduct | No plagiarism, harassment, discrimination, or judging manipulation. | participant attestation and provenance | participant gate |
| Enforcement/platform limits | Any rule breach blocks release; Bright Data geographic availability must be confirmed by the participant. | final compliance review | pending |

## Required submission artifacts

- [x] Public repository exists.
- [x] Clear README exists.
- [x] Safe example structured output exists at
      `examples/structured-output.json`.
- [x] Custom Scraper Studio create/run evidence exists for Dynacore.
- [x] Deployed public application is verified signed out.
- [ ] Demo video (maximum 3 minutes) is public/unlisted and verified.
- [ ] Scraper Studio explanation reflects verified live behavior.
- [x] AI-assistant disclosure is included in the README and submission plan.
- [ ] AI-assistant disclosure is included in the final form and video.
- [ ] Participant can explain the code and architecture without relying on an
      AI-generated script.

The Marvel/Sony affiliation disclaimer belongs in the event rules; Raster does
not use those brands, characters, artwork, or imply affiliation.
