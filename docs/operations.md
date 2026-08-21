# Refresh operations

Raster’s scheduled collection is deliberately one small, protected request at
a time. GitHub Actions never receives the Bright Data provider key. It signs a
request to the deployed server route; the server owns provider access,
validation, normalization, and hosted PostgreSQL writes through private Hyperdrive/VPC.

## GitHub configuration

Create these repository or environment secrets without putting their values in
issues, commits, logs, screenshots, or demo footage:

| Secret | Purpose |
| --- | --- |
| `RASTER_REFRESH_URL` | HTTPS URL of the deployed protected refresh route. |
| `RASTER_INGEST_HMAC_SECRET` | Dedicated HMAC secret shared only with the route and workflow. |

The Bright Data API key belongs only in the deployed route’s secret store. It is
not a GitHub Actions secret for this workflow.

## Scraper Studio CLI preparation

The organizer guide uses the official Bright Data CLI without a global install.
The following command was verified against CLI `0.3.5` on 2026-08-21:

```bash
npx -y -p @brightdata/cli bdata --version
```

Authenticate with `bdata login`, which opens the provider login flow. Do not
pass a key with `--api-key` in a recorded terminal, shell history, issue, or
demo. The replacement credential must be stored through the provider login or
another approved secret store, never copied into repository files.

The live proof sequence is:

```bash
npx -y -p @brightdata/cli bdata scraper create \
  'https://public-retailer.example/gpus' \
  'Extract public GPU offers as the Raster contract fields.' \
  --name raster-source --json

npx -y -p @brightdata/cli bdata scraper run \
  'c_REDACTED' 'https://public-retailer.example/gpus' --json

npx -y -p @brightdata/cli bdata scraper heal \
  'c_REDACTED' 'The required price field is missing after a controlled selector change.' \
  --url 'https://public-retailer.example/gpus' --json

npx -y -p @brightdata/cli bdata scraper approve \
  'c_REDACTED' --url 'https://public-retailer.example/gpus' --json
```

The URLs, prompt, and Collector ID above are placeholders, not runnable source
claims. During the real flow, send CLI JSON through the repository sanitizer
before saving evidence; never commit raw provider output.

## Same-ID healing proof harness

The healing proof is intentionally read-only. It consumes real local provider
artifacts later; it does not call Bright Data or fabricate a before/preview/after
sequence. Keep those raw files in ignored `evidence/raw/`. First capture a
baseline with `scripts/check-source-health.ts`, passing the exact source,
allowlisted input URL, controlled missing field, and downstream consumer files.
Then run `scripts/heal-source.ts` with the baseline, the inspected provider
preview, and the rerun artifact. Both commands fail closed on missing or
malformed capture envelopes, secret-shaped fields, an off-domain input, a
changed or unregistered `c_*` Collector ID, an unresolved required field,
non-successful provider status, missing response/run identity, malformed rows,
unsafe output paths, or changed downstream hashes. The baseline must include
the source registry, refresh route/helper, ingestion, PostgreSQL catalog
repository, and storefront files. A failed post-heal validation emits no proof
and leaves the last-known-good catalog untouched.

The provider envelope is required to bind `collector_id`, `source_slug`,
`input_url`, top-level `status`, response/run identity, and `rows`; row-level
status cannot approve a heal. Before/after status must be exactly successful or
completed, while preview status must be an exact positive approval state. The
generated baseline/proof contain only fixed public input metadata,
repository-relative artifact paths, row counts, and SHA-256 hashes. They do
not replace the live evidence gate: do not mark the evidence matrix complete
until the provider commands were actually run and the artifacts were manually
reviewed for secret and public-data safety.

See [`evidence/healing/README.md`](../evidence/healing/README.md) for the exact
offline operator sequence.

## Workflow behavior

`.github/workflows/collect.yml` runs on a daily schedule and supports
`workflow_dispatch`. The schedule expands into four independently locked jobs;
manual dispatch selects exactly one allowlisted slice:

| Slice | Market | Source |
| --- | --- | --- |
| `us-central-computer` | US / USD | Central Computers |
| `uk-overclockers-uk` | UK / GBP | Overclockers UK |
| `in-md-computers` | IN / INR | MDComputers |
| `sg-dynacore` | SG / SGD | Dynacore Technologies |

Every scheduled slice remains safely `not_configured` until its source passes
eligibility and receives a real role-keyed Collector ID. Concurrency is
serialized per source slice, each job has an eight-minute timeout, and
permissions are read-only.

## Onboarding another country

Country expansion is runtime-driven through the authenticated Country Pack
route and does not require a code deploy. To add a market safely:

1. Submit its route slug, ISO-style market code, currency, locale, symbol, and a
   server-recognized retailer slug to the signed Country Pack route.
2. Record dated public-data eligibility and Bright Data pre-built-library
   exclusion evidence. The pack remains pending and is not selectable.
3. Create and run a source-specific custom Scraper Studio collector, record its
   real `c_*` ID, and validate its output against the shared contract.
4. Submit the sanitized creation/run evidence. One PostgreSQL transaction marks the
   pack ready and binds the server-resolved source; it then appears in the
   selector without redeploying Raster.

The selector, validation, currency formatting, and PostgreSQL query layer merge ready
Country Packs with the baseline registry. Shopper input cannot supply a source
URL or Collector ID, and an admitted source binding is immutable.

### Exact Country Pack rehearsal

The committed pending and ready files under `examples/` are non-runnable
templates: the `.example` host, `c_REPLACE_AFTER_CREATE`, and date placeholders
are not source or live-collector claims. Copy them outside the repository,
replace every placeholder only after eligibility and create/run proof exists,
then use the HTTPS production endpoint:

```bash
export RASTER_MARKET_PACK_URL='https://abhijitmohanty.com/scrapper/api/market-packs'

node scripts/sign-market-pack.mjs \
  --url "$RASTER_MARKET_PACK_URL" \
  --file '/secure/path/country-pack.pending.json'
# safe response: {"slug":"japan","status":"pending"}
```

At this point `/scrapper/data-health` shows the pack as pending and the shopper
selector must not contain it. After the real collector output passes the shared
contract, copy the exact same country/source/collector boundary into the ready
payload, add only repository-local sanitized `evidence/...` references and
their ISO dates, then submit:

```bash
node scripts/sign-market-pack.mjs \
  --url "$RASTER_MARKET_PACK_URL" \
  --file '/secure/path/country-pack.ready.json'
# safe response: {"slug":"japan","status":"ready"}
```

Refresh `/scrapper/data-health`, then the home page. The ledger must show ready
and the country must enter the selector without a deploy. Record the safe
responses and browser state; never record the HMAC secret or raw provider body.
An already-ready pack cannot change its country, currency, source, collector,
URL/host boundary, or source identity while reusing old evidence.

## Signing contract

The signer sends this compact JSON body:

```json
{"sourceSlugs":["central-computer"],"role":"combined"}
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
- A failed/partial collection must preserve the last known good PostgreSQL offer. The
  route, not this workflow, owns that transaction and quarantine behavior.
- The workflow is not a retry loop. Investigate a failed source, then rerun one
  slice manually after the route/source is safe.

## Operator checklist

- [x] Confirm the route URL is HTTPS and points to the protected deployment.
- [x] Confirm both workflow secrets exist without displaying their values.
- [ ] Confirm the chosen source has passed public-data and pre-built coverage
      checks in [source-eligibility.md](source-eligibility.md).
- [ ] Dispatch one slice manually and inspect the safe Action summary.
- [ ] Confirm no provider key, authorization header, or raw provider body is in
      the log or summary.
- [ ] Confirm PostgreSQL/current offers remain intact when a source fails validation.
