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

## Follow-up fix round 1

- Hydration now canonicalizes stored IDs against the complete current safe market catalog (encoded for the client boundary), so changing filters cannot drop a valid selection. Stored field tampering cannot override the canonical title, market, price, currency, health, freshness, or retailer URL; malformed/unknown/corrupted storage fails closed.
- Introduced a desk context and `SourceDeskAddButton`; every offer card now owns its keyboard-accessible pressed-state Add/Remove control while the provider retains shared selection state and explicit cross-market replacement acknowledgement.
- Replaced source-regex-only assertions with an executable child-process test of canonicalization, brief construction, field integrity, dated reminder, and corrupted-storage empty behavior.
- Focused `npm run test:render` passed (9 tests); lint/build passed. The full repository gate was run in the prior round and will be rerun before the follow-up commit.

## Follow-up fix round 2

- The client boundary now receives the complete current safe catalog across all supported markets, separately from the visible filtered card list. Stored IDs are canonicalized from that full catalog, so URL filters and market navigation cannot implicitly discard a valid selection.
- Cross-market add behavior is modeled as an explicit state transition: the existing desk remains selected and persisted while a pending offer waits for acknowledgement; only the acknowledgement replaces it.
- Added executable transition assertions covering retention across a filter view, pending cross-market replacement, acknowledged replacement, canonical field integrity, and corrupted/unknown storage failure.
- `npm run lint` passed; `npm run test:render` passed (9 tests); `npm test` passed (124 unit, 16 PostgreSQL, 9 rendered tests).
