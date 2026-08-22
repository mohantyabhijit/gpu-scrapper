# Task 2 report — Dynacore live collector

## Status

DONE_WITH_CONCERNS

## Provider stages

- Credential: Keychain service `my-api-key` was resolved only into the
  `BRIGHTDATA_API_KEY` process environment; no key value was printed, persisted,
  or passed as a CLI argument.
- Create: PASS. The exact registered target URL, manifest description, and
  `raster-sg-dynacore-gpus` name produced Collector ID `c_mt3qzv5p215cci1r2e`.
- Run 1: PASS. The same Collector ID and exact registered URL returned three
  public cards. The safe Dynacore adapter rejected one graphics-card holder,
  retained two GPU rows, mapped the provider price object, defaulted missing
  stock labels to `unknown`, and both rows passed the explicit contract.
- Repeat run: PASS. The same Collector ID and URL returned three cards again;
  one holder was rejected and two GPU rows passed the explicit contract.
- Registration: PASS. Dynacore is enabled only for the role-keyed combined
  Collector ID after both reads passed.
- Temporary raw create/run files and provider stderr were removed with exact
  file-path unlink operations followed by exact temporary-directory removal.

## Owned files and sanitized evidence

- `config/sources.ts`
- `scrapers/manifests/dynacore.json`
- `scrapers/adapters/dynacore.ts`
- `lib/ingest.ts`
- `scripts/collect.ts`
- `evidence/collectors/README.md`
- `evidence/collectors/dynacore-create-20260822.json`
- `evidence/collectors/dynacore-run-20260822-01.json`
- `evidence/collectors/dynacore-run-20260822-02.json`
- `evidence/sources/dynacore-eligibility.md`
- `docs/source-eligibility.md`
- `docs/evidence-matrix.md`
- `docs/rules-compliance.md`
- `tests/dynacore-adapter.test.mjs`
- relevant collector tests and `package.json`

The three collector artifacts contain sanitizer output only. Each run artifact
records three source cards, two valid rows, one quarantined accessory, and the
same Collector ID; no provider payload, authorization, cookie, account, or
personal data is retained.

## Verification

- `npm run test:u2`: PASS (18 tests)
- `npm run test:unit`: PASS (128 tests)
- `npm run test:postgres`: PASS (16 tests)
- `npm run lint -- --no-warn-ignored`: PASS
- `npx tsc --noEmit`: PASS
- `npm run build`: PASS
- Secret-shaped field/value scan across owned evidence and changed code: PASS;
  only expected documentation and environment-variable names matched.
- `git diff --check`: PASS

## Commit

- `db04ab2 feat(gpuverse): prove dynacore live collector`

## Self-review

- The registry URL, market, currency, role, and Collector ID are bound to the
  same source; no arbitrary URL or guessed ID is accepted.
- The adapter strips provider-only fields, rejects the observed accessory, and
  leaves malformed required fields for the shared validator instead of
  weakening that validator. It is covered by focused tests and wired into the
  live ingestion/collection paths.
- The pre-existing `README.md` modification was left unstaged and untouched.
- No unrelated collector was used.

## Concerns

- Dynacore's generated collector omitted stock labels on two accepted cards;
  the adapter records the contract's honest `unknown` availability rather than
  inferring stock.
- This task proves the provider create/run/repeat-read and source registration;
  downstream hosted-PostgreSQL refresh, storefront publication, and same-ID
  healing remain separate release gates.
