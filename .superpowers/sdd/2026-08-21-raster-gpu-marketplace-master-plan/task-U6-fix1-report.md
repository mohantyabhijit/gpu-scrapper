# U6 healing fix round 1 report

## Status

Implemented and committed the fail-closed same-ID healing evidence hardening.
No Bright Data calls, credentials, live provider state, or pushes were used.

## Changed files

- `lib/evidence/healing-harness.ts`
  - Requires a top-level capture envelope with `collector_id`, `source_slug`,
    `input_url`, `status`, response/run identity, and `rows`.
  - Accepts only exact normalized positive preview statuses and exact successful
    before/after statuses; row-level status text cannot approve a preview.
  - Requires a non-secret response/run identity for successful captures.
  - Rejects root arrays, empty recovery output, null/scalar/nested-array rows,
    and any row that does not pass the shared contract.
  - Binds the evidence Collector ID to an enabled source registry entry.
  - Requires unchanged hashes for the source registry, refresh helper and route,
    ingestion, PostgreSQL catalog repository, and storefront.
  - Adds repository-relative output path validation for traversal, symlink,
    non-regular, and secret-like targets.
- `scripts/check-source-health.ts`
- `scripts/heal-source.ts`
  - Use the shared safe output-path resolver.
- `scrapers/contracts.ts`
  - Missing availability now fails raw contract validation instead of silently
    becoming `unknown`.
- `tests/healing-policy.test.mjs`
  - Adds focused coverage for status classes, missing identities, malformed
    rows/envelopes, missing availability, registry binding, incomplete
    downstream baselines, last-known-good preservation, and output paths.
- `evidence/healing/README.md`
  - Documents the safe capture envelope, required consumers, statuses, and
    post-heal failure behavior.
- `docs/operations.md`
  - Updates the U6 operational guardrails and evidence boundary.

## Design decisions

The provider payload is treated as an envelope rather than an arbitrary JSON
tree. This makes the Collector ID, fixed source/URL, status, response identity,
and row container independently auditable and prevents a nested status or
provider wrapper from being mistaken for approval. Before and after captures
must be successful and contain at least one row; preview rows are not trusted
for contract recovery.

The baseline now requires all six relevant consumers:

```text
config/sources.ts
lib/brightdata/refresh.ts
app/api/refresh/route.ts
lib/ingest.ts
lib/d1/repository.ts
app/page.tsx
```

The harness remains read-only with respect to catalog state. A failed after
validation raises before a proof can be emitted, so the last-known-good catalog
is preserved.

## Verification

Commands and results:

```text
node --experimental-strip-types --test tests/healing-policy.test.mjs
10 tests passed, 0 failed

npm run test:unit
95 tests passed, 0 failed

npx eslint lib/evidence/healing-harness.ts scripts/check-source-health.ts scripts/heal-source.ts scrapers/contracts.ts tests/healing-policy.test.mjs
passed with no errors

npx tsc --noEmit --pretty false
passed

git diff --check
passed
```

## Commit

`a8b1e9379a69ed834dafc9ef486bbefd85d3642d` — `fix: harden same-id healing evidence`

Only the seven owned implementation/documentation/test files were staged and
committed. Existing unrelated worktree edits remain unstaged.

## Self-review and concerns

- The static source registry intentionally has no enabled live collectors, so a
  real operator run remains blocked until eligibility, create/run evidence, and
  a real role-keyed Collector ID are added through the approved workflow.
- The proof harness does not auto-approve or invoke `bdata scraper heal`; live
  authenticated execution and manual public-data review remain required for
  release evidence.
- The downstream list deliberately includes both the refresh helper and the
  protected refresh route to make the trigger boundary explicit.
