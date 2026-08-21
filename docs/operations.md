# Refresh operations

Raster’s scheduled collection is deliberately one small, protected request at
a time. GitHub Actions never receives the Bright Data provider key. It signs a
request to the deployed server route; the server owns provider access,
validation, normalization, and D1 writes.

## GitHub configuration

Create these repository or environment secrets without putting their values in
issues, commits, logs, screenshots, or demo footage:

| Secret | Purpose |
| --- | --- |
| `RASTER_REFRESH_URL` | HTTPS URL of the deployed protected refresh route. |
| `RASTER_INGEST_HMAC_SECRET` | Dedicated HMAC secret shared only with the route and workflow. |

The Bright Data API key belongs only in the deployed route’s secret store. It is
not a GitHub Actions secret for this workflow.

## Workflow behavior

`.github/workflows/collect.yml` runs on a daily schedule and supports
`workflow_dispatch`. Each run selects exactly one allowlisted slice:

| Slice | Market | Source |
| --- | --- | --- |
| `us-central-computer` | US / USD | Central Computers |
| `uk-overclockers-uk` | UK / GBP | Overclockers UK |
| `in-md-computers` | IN / INR | MDComputers |
| `sg-dynacore` | SG / SGD | Dynacore Technologies |

The default scheduled slice is `us-central-computer`. Run the other slices
manually while source eligibility and Bright Data pre-built-library exclusion
are still being verified. Concurrency is serialized, the job has an eight
minute timeout, and permissions are read-only.

## Onboarding another country

Country expansion is configuration-driven but intentionally not open-ended at
runtime. To add a market safely:

1. Add its route slug, ISO-style market code, currency, locale, and symbol to
   `config/markets.ts`.
2. Add public retailer candidates to `config/sources.ts` and complete the
   source-eligibility checklist before enabling any of them.
3. Create and run a source-specific custom Scraper Studio collector, record its
   real `c_*` ID, and validate its output against the shared contract.
4. Add the scheduled/manual refresh slice and verify market-local D1 reads.

The selector, validation, currency formatting, and D1 query layer all derive
from the market registry. Arbitrary request parameters cannot create a new
country or currency and cannot bypass the allowlisted sources.

## Signing contract

The signer sends this compact JSON body:

```json
{"market":"US","source_slug":"central-computer"}
```

It adds:

- `X-Raster-Timestamp`: Unix timestamp in seconds;
- `X-Raster-Signature`: `sha256=` followed by
  `HMAC-SHA256(secret, timestamp + "." + exact_body_bytes)`;
- `Content-Type: application/json`.

The route must reject a missing/invalid signature, a timestamp outside its
five-minute replay window, an unknown market/source pair, and a request that is
not HTTPS-authenticated. Signature comparison should be constant-time. The
workflow signer and route must sign/verify the exact same body bytes.

## Local dry run of the signer

Use a secure local secret injection mechanism. Do not echo or paste the secret:

```bash
RASTER_REFRESH_URL="https://example.invalid/api/refresh" \
RASTER_INGEST_HMAC_SECRET="(load from secure storage)" \
node scripts/sign-refresh.mjs --slice us-central-computer
```

For an offline test, use `tests/workflow-sign-refresh.test.mjs`; it uses mocked
fetch and never calls a provider or a real route.

## Failure handling

- Missing workflow secrets fail before any request is made.
- Unsupported slices fail before any request is made.
- Timeouts and non-2xx responses fail the job without printing the route body.
- The job summary contains only the selected slice and an allowlisted response
  summary; provider keys and raw provider error bodies are never copied.
- A failed/partial collection must preserve the last known good D1 offer. The
  route, not this workflow, owns that transaction and quarantine behavior.
- The workflow is not a retry loop. Investigate a failed source, then rerun one
  slice manually after the route/source is safe.

## Operator checklist

- [ ] Confirm the route URL is HTTPS and points to the protected deployment.
- [ ] Confirm both workflow secrets exist without displaying their values.
- [ ] Confirm the chosen source has passed public-data and pre-built coverage
      checks in [source-eligibility.md](source-eligibility.md).
- [ ] Dispatch one slice manually and inspect the safe Action summary.
- [ ] Confirm no provider key, authorization header, or raw provider body is in
      the log or summary.
- [ ] Confirm D1/current offers remain intact when a source fails validation.
