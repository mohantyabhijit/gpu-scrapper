# Task 1 report: sourcing desk

## Changed files

- `components/sourcing-desk.tsx` — added the client-side bounded source desk, validated browser persistence, one-market replacement acknowledgement, safe retailer links, provenance fields, clear/remove controls, clipboard brief construction, and failure fallback.
- `app/page.tsx` — passes the server-rendered filtered offer snapshot into the progressive-enhancement desk while preserving the existing catalog and fixture/live label.
- `app/globals.css` — added responsive source-desk summary, panel, confirmation, provenance list, and add-action styling.
- `tests/rendered-html.test.mjs` — added server-markup and source-desk serialization/brief assertions.

`README.md`, collector/config/secret/deployment files were not modified.

## Behavior

The homepage remains server-rendered and useful with JavaScript disabled. When JavaScript is available, each visible offer has a keyboard-accessible pressed-state add/remove button. Up to six validated selections are stored under one local-storage key. Invalid records, malformed timestamps/URLs, unknown offer IDs, and unavailable storage fail closed without exposing or sending data.

Selections remain market-local. Adding another market pauses with an explicit acknowledgement before replacing the desk; no currencies are mixed or totalled. The expanded desk shows model/brand, retailer, market/currency, observed time, availability, source health, fixture state, and a safe outbound retailer URL. The copy action emits a deterministic field-limited brief with a dated verification reminder and reports clipboard success or a readable manual-copy fallback.

## Test commands/results

- `npm run lint` — passed.
- `npm run build` — passed.
- `npm run test:render` — passed (9 tests).
- `npm test` — passed (124 unit tests, 16 PostgreSQL tests, 9 rendered tests).
- `git diff --check` — passed.

## Self-review

- Scope is limited to the assigned component, homepage, styles, rendered tests, and this report.
- No network, provider, collector, credential, deployment, or README action was performed.
- Server markup contains the desk summary and add actions, while persisted state hydrates only after the initial render to avoid server/client storage coupling.
- Clipboard and localStorage failures are handled as user-visible browser limitations rather than treated as successful operations.

## Concerns

- The browser desk is intentionally a local snapshot; it does not refresh or reconcile selected offers against a provider. Retailer verification remains required, especially for fixture rows.
- The add controls are rendered as a compact offer-action strip immediately before the offer grid so the server catalog stays unchanged; the expanded desk remains the authoritative selected-offer view.
