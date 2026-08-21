# Public evidence workflow

Evidence inputs from Bright Data must remain local and ignored. Put create,
run, and heal JSON responses under `evidence/raw/`; this directory is excluded
by `.gitignore` and must never be committed. The sanitizer emits a small,
reviewable summary under `evidence/public/`, which is the only evidence output
that may be tracked after a human secret scan.

## Exact commands

```bash
mkdir -p evidence/raw evidence/public
node scripts/sanitize-evidence.mjs \
  --kind create \
  --input evidence/raw/create.json \
  --output evidence/public/create-summary.json

node scripts/sanitize-evidence.mjs \
  --kind run \
  --input evidence/raw/run.json \
  --output evidence/public/run-summary.json

node scripts/sanitize-evidence.mjs \
  --kind heal \
  --input evidence/raw/heal.json \
  --output evidence/public/heal-summary.json
```

`--kind` accepts only `create`, `run`, or `heal`. If omitted, the kind is
inferred from the input filename and defaults to `run`. Collector IDs matching
`c_*` are retained as identity evidence. Authorization headers, API keys,
tokens, cookies, credentials, secrets, private keys, provider/raw error
bodies, and arbitrary provider fields are omitted. Public URLs lose query and
fragment components before they are emitted.

Structured rows are reduced to the public product fields used by Raster and
sampled at a maximum of five rows. The summary records counts and redaction
counts, but never includes the raw provider payload. Review the generated JSON
for accidental private data before adding it to a commit or submission.

## Pending state

No live Bright Data create/run/heal evidence is committed yet. Until a real
authenticated flow is completed, keep the corresponding evidence rows marked
`pending` in [the evidence matrix](../docs/evidence-matrix.md). A sanitized
summary is not proof of a live collector, a successful PostgreSQL write, a scheduled
run, or same-ID healing by itself.
