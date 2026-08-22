# Raster live-proof completion plan

## Objective

Replace Raster's fixture-only release state with a compliant, judge-verifiable Singapore live slice backed by custom Bright Data Scraper Studio collectors, hosted PostgreSQL, the public storefront, a scheduled/manual refresh, and one same-ID self-heal demonstration.

## Non-negotiable boundaries

- Collect only public, signed-out retailer catalog and product data.
- Never collect account, cart, checkout, contact, review, personal, paywalled, restricted, or government data.
- A source may be enabled only after an authenticated Bright Data library search proves the domain has no pre-built scraper.
- API keys remain in macOS Keychain, Cloudflare secrets, and narrowly scoped CI secrets; no raw provider output or credential enters git, screenshots, logs, or demo material.
- Never use the unrelated `c_mt2nbsqd1akac96fiz` Dyson-parts collector as Raster evidence or data.
- Preserve the user's pre-existing local `README.md` edit unless explicitly reconciled later.

## Task 1 — Correct and prove Dynacore eligibility

Update the Dynacore catalog URL from the stale graphics-card path to the current public `/collections/gpu` collection. Record dated public-page findings and the authenticated Scrapers Library exclusion result. Keep the source disabled and its Collector ID empty until Task 2 succeeds.

Verification:

- Source registry and eligibility documents agree on the exact URL.
- The live page exposes actual GPU products, SGD, canonical product links, and no signed-in requirement.
- Targeted source/contract tests pass.
- No unrelated local changes are staged.

## Task 2 — Create, run, validate, and register Dynacore's custom collector

Create one combined custom Scraper Studio collector from the terminal using the Keychain-backed credential. Extract only Raster's public GPU row contract, run the current catalog URL, reject the accessory row, validate the GPU rows, preserve only sanitized evidence, and register the stable `c_*` ID. Enable Dynacore only after a repeat read passes.

Verification:

- Real create/run/repeat-read artifacts are sanitized and indexed.
- Every accepted row passes source host, currency, required-field, timestamp, and personal-data rejection checks.
- The same collector ID is used for both reads.
- Tests and secret scans pass.

## Task 3 — Add the second Singapore live source and reach useful breadth

Run the same authenticated eligibility, public-page, create/run, repeat-read, registration, and validation gates for the best viable secondary Singapore source. Prefer the source that yields enough same-currency overlap to support company sourcing decisions. Reach at least 12 valid live offers, five canonical GPU models, and three reviewed cross-retailer matches; if a candidate cannot meet its gate, document the failure and move to the next eligible Singapore candidate.

Verification:

- Two independent enabled Singapore sources have stable custom Collector IDs.
- Breadth and overlap thresholds are computed from validated rows, not fixtures.
- Cross-retailer identity matches retain source title, SKU/MPN, URL, and observed time.

## Task 4 — Prove production ingestion and refresh automation

Ingest the validated live rows through Raster's protected server-owned refresh path into hosted PostgreSQL. Configure the minimum GitHub environment secrets needed by the existing scheduled/manual workflow, dispatch a live run, and surface safe per-source results in the Action summary.

Verification:

- PostgreSQL current offers and observations contain live collector-backed rows.
- The public catalog renders those rows without a fixture label.
- Unsigned refresh remains `401` and arbitrary URLs/Collector IDs remain impossible.
- One manual Action run is green and contains no secrets or raw provider error bodies.

## Task 5 — Demonstrate same-ID self-healing

Capture a controlled contract failure for one registered collector, invoke `bdata scraper heal`, review and approve the preview, then rerun the same input using the same Collector ID. Preserve before/preview/after evidence and prove no downstream consumer or registry identity changed.

Verification:

- Before output fails a named contract field.
- Preview/approval is recorded without secrets.
- After output passes using the identical `c_*` ID.
- Last-known-good data remains visible throughout the controlled failure.

## Task 6 — Release and demo audit

Refresh README/evidence/QA/demo documents with current counts, deployment commit, live source IDs, Action run, PostgreSQL proof, and self-heal timestamps. Run full static, unit, PostgreSQL, render, secret, deployment, responsive, keyboard, and key sourcing-flow QA; push clean commits to `main` and verify `https://abhijitmohanty.com/scrapper/` end to end.

Verification:

- Every release-facing claim links to current evidence.
- The three-minute demo can be performed honestly without private dashboards or visible credentials.
- GitHub `main`, green CI, deployed Worker version, and public route agree on the release commit.
