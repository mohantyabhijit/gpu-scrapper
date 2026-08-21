# U2 source registry, manifests, and contracts report

## Status

Implemented and committed the safe pre-credential U2 scope for the Singapore
P0 comparison pair (Dynacore + TechDeals) and PC Themes backup. No Bright Data
call, collector create/run/heal, credential read, or provider-state mutation was
performed.

## Changed files

- `config/sources.ts`: removed rejected Tradezone from the runnable registry;
  added PC Themes; made TechDeals secondary; kept all three SG candidates
  disabled with empty role-keyed IDs and `combined` as the configured role.
- `scrapers/manifests/dynacore.json`, `scrapers/manifests/tech-deals.json`,
  `scrapers/manifests/pc-themes.json`: explicit public GPU row manifests bound
  to the registered SG/SGD catalog URLs; Tradezone manifest removed.
- `scrapers/contracts/gpu-offer.schema.json`: published strict explicit row
  schema with `additionalProperties: false` and all 14 required fields.
- `scrapers/contracts.ts`: retained `raw_model`, validates optional timestamps,
  exposes the shared explicit-field contract, and validates Bright Data arrays or
  recognized wrappers with safe per-code counts and no raw-row output.
- `scripts/validate-collector-output.ts`: local JSON validator with bounded
  JSON summaries, wrapper/member/empty-result checks, field-shape and PII-like
  key rejection, source-host/market/currency/timestamp checks, and no key use.
- `scripts/collect.ts`: registered-source/role-only operator runner using the
  existing bounded Bright Data client; disabled/unconfigured sources and
  provider failures fail safely without printing keys or persisting bodies.
- `evidence/collectors/README.md`: CLI-first create/run/sanitize/validate
  sequence, secure temporary output guidance, real-ID gates, and pending fields.
- `docs/source-eligibility.md`: factual active-candidate register, Singapore
  roles, pending gates, and Tradezone rejection record; removed unsupported
  authenticated pre-built-match claim.
- `evidence/sources/pc-themes-eligibility.md`: dated conditional public-page
  audit with pending live and semantic fields.
- `tests/collector-contract.test.mjs`: manifests, schema, explicit rows,
  `raw_model`, nullable-field presence, extra/PII-like fields, malformed rows,
  timestamps, wrappers, URL/currency gates, and no-fake-ID coverage.
- `tests/collector-cli.test.mjs`: parser and registry target-resolution tests
  without provider calls.
- `package.json`: `test:u2`, `collect`, and `validate:collector` scripts; U2
  CLI test included in `test:unit`.

## Verification

All commands were run from `/Users/abhijitmohanty/Documents/ChatGPT/scrapverse/gpuverse`:

| Command | Result |
| --- | --- |
| `npm run test:u2` | PASS — 15 tests, 15 passed, 0 failed |
| `npm run test:unit` | PASS — 105 tests, 105 passed, 0 failed |
| `npm run lint` | PASS |
| `npx tsc --noEmit --pretty false` | PASS |
| `git diff --check` | PASS |
| `npm run collect -- --source dynacore --role combined` | Expected safe `not_configured` JSON summary; no provider call; process exit 1 until an authenticated real ID is configured |
| `npm run validate:collector -- --input /tmp/u2-valid.json --source dynacore` | PASS — safe JSON summary with one accepted row; no row output |

## Commit

Implementation commit: `58a8a9b` (`feat(gpuverse): add safe collector contracts and registry`).

The required report is intentionally being recorded as a follow-up artifact
commit so the implementation commit remains directly identifiable above.

## Self-review

- Registry contains exactly four markets and no Tradezone runnable entry.
- Dynacore, TechDeals, and PC Themes are disabled, have empty `collectorIds`,
  and use only `combined`.
- Product URLs are constrained to registered HTTPS hosts; currency and market
  are source-bound; empty, malformed, extra-field, PII-like, timestamp-invalid,
  and unsupported output fails closed.
- `raw_model` is retained through the shared validated offer shape.
- Operator input cannot supply arbitrary URLs or Collector IDs; provider bodies
  are not persisted or printed.
- Existing unrelated README and U6 work were left unstaged and untouched.
- No secrets, raw credentials, live IDs, or provider output were added.

## Live blockers

The implementation deliberately leaves these gates pending: authenticated
Bright Data pre-built exclusion, custom Collector Studio creation, a successful
live run with sanitized explicit rows, repeat-read stability, and final source
enablement. PC Themes additionally needs confirmed rendered stock semantics,
explicit SGD pricing semantics, authenticated pre-built exclusion, and stable
overlap evidence. Tradezone remains rejected because its official terms prohibit
automated systems and its research evidence is retained only as a rejection
record.
