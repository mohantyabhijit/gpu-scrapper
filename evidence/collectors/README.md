# Collector evidence (operator runbook)

This directory contains sanitized evidence only. It does not contain API keys,
cookies, authorization headers, raw provider bodies, or guessed Collector IDs.
Dynacore's combined collector is live-proven below; TechDeals and PC Themes
remain disabled until their authenticated gates and explicit row contracts pass.

## CLI-first sequence

1. Review the registered source and its manifest. The URL, market, currency,
   and role must come from `config/sources.ts`; do not substitute a URL or ID.
2. Authenticate with the Bright Data CLI using its approved login flow. Never
   pass a key on a command line or save provider login output in this repo.
3. Create a custom collector against the exact registered public URL. The CLI
   takes the URL and description as positional arguments; the description is
   capped at 500 characters:

   ```bash
   npx -y -p @brightdata/cli bdata scraper create \
     'https://registered-public-catalog.example/gpus' \
     'Extract every public GPU product card with the Raster explicit row contract; use null for unavailable optional public fields; exclude contacts, reviews, accounts, cart, checkout, and personal data.' \
     --name raster-source-gpus --json -o /tmp/raster-create.json
   ```

   Confirm the authenticated response contains a real `c_*` ID. A placeholder
   or guessed ID must never enter the registry or evidence.
4. Run that real ID only against the registered URL and save the provider body
   outside git, in a secure temporary directory:

   ```bash
   npx -y -p @brightdata/cli bdata scraper run \
     'c_REAL_ID_FROM_CREATE' \
     'https://registered-public-catalog.example/gpus' \
     --json -o /tmp/raster-collector-output.json
   ```

5. Sanitize the temporary body before any review or sharing. Use the existing
   sanitizer and inspect the sanitized copy for contacts, account data, and
   provider metadata. Delete the raw temporary body after review; never commit
   it:

   ```bash
   node scripts/sanitize-evidence.mjs \
     --input /tmp/raster-collector-output.json \
     --output /tmp/raster-collector-sanitized.json
   node --experimental-strip-types scripts/validate-collector-output.ts \
     --input /tmp/raster-collector-output.json \
     --source dynacore
   ```

   The sanitizer output is the reviewable evidence summary; the validator
   reads the secure temporary provider file and prints only bounded counts and
   validation codes. An empty, malformed, off-domain, wrong-currency,
   missing-field, PII-bearing, or timestamp-invalid result fails closed. Delete
   the raw temporary body after validation.
6. After the authenticated pre-built exclusion, custom create, successful run,
   sanitized review, and repeat-read gates all pass, record the real ID under
   its role and enable the source in a separately reviewed change. Until then,
   leave `collectorIds` empty and `enabled: false`.

For routine registered-source operation after those gates, use the local
operator runner. It accepts only a registered slug and configured role, reads
`BRIGHTDATA_API_KEY` from the process environment, never prints it, does not
accept arbitrary URLs or IDs, and never persists provider rows:

```bash
node --experimental-strip-types scripts/collect.ts \
  --source dynacore --role combined
```

The current repository intentionally has no configured runnable source, so this
command safely returns a `not_configured` summary until authenticated evidence
is complete. A provider timeout, bounded provider error, or invalid row set is
reported as a status and per-code count only.

## Pending fields

TechDeals and PC Themes still have `bright_data_prebuilt_exclusion`, real
collector IDs, successful live output, repeat-read stability, and final
enablement pending. Dynacore's dated proof is indexed as
`dynacore-create-20260822.json`, `dynacore-run-20260822-01.json`, and
`dynacore-run-20260822-02.json`. Keep source URLs and dates in the relevant
eligibility record, with all public-data and terms caveats intact.
