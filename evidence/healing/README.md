# Same-ID healing evidence harness

The operator harness is an offline validator for the eventual live
Scraper Studio capture. It never calls Bright Data, approves a collector, or
creates evidence from a missing input. The three provider JSON files must be
real, locally captured artifacts; raw files stay under the ignored
`evidence/raw/` directory.

Each capture must use this envelope (the fields are top-level and binding):

```json
{
  "collector_id": "c_REPLACE_WITH_REAL_ID",
  "source_slug": "central-computer",
  "input_url": "https://www.centralcomputer.com/all-products/hardware/video-cards/video-cards.html",
  "status": "completed",
  "response_id": "provider-response-id",
  "rows": [{ "title": "…", "product_url": "…", "price": "…", "currency": "USD", "availability": "In Stock", "market": "US" }]
}
```

Before and after captures require an exact successful top-level status
(`completed`, `success`, or `succeeded`) and a non-secret `response_id` or
`run_id`. A preview requires an exact positive top-level status such as
`awaiting_approval`, `preview_ready`, or `approved`; row-level status text is
never used as approval. `rows` must be an array of object rows, so nulls,
scalars, nested arrays, and root JSON arrays fail closed. The Collector ID must
also be present in the enabled source registry entry for the selected source.

## Before capture

Run the health check after a controlled live break has produced a failing
provider artifact. The source and URL are checked against the source registry,
and the selected required field must be absent while the shared Raster
contract rejects every row. The baseline hashes every relevant downstream
consumer so the later proof can show that healing did not change the source
registry, refresh/trigger, ingestion, PostgreSQL catalog repository, or
storefront:

```text
config/sources.ts
lib/brightdata/refresh.ts
app/api/refresh/route.ts
lib/ingest.ts
lib/d1/repository.ts
app/page.tsx
```

All six paths are required; extra repository-relative consumer paths may also
be supplied.

```bash
node --experimental-strip-types scripts/check-source-health.ts \
  --source central-computer \
  --collector c_REPLACE_WITH_REAL_ID \
  --input-url https://www.centralcomputer.com/all-products/hardware/video-cards/video-cards.html \
  --required-field price \
  --before evidence/raw/heal-before.json \
  --consumer config/sources.ts \
  --consumer lib/brightdata/refresh.ts \
  --consumer app/api/refresh/route.ts \
  --consumer lib/ingest.ts \
  --consumer lib/d1/repository.ts \
  --consumer app/page.tsx \
  --output evidence/healing/baseline.json
```

The command fails closed when an artifact is missing, malformed, outside the
allowlisted host, contains credential-shaped material, has another or
unregistered Collector ID, or does not demonstrate the selected contract
failure. Output paths are repository-relative regular files: lexical traversal,
symlink traversal, and secret-like names are rejected. `baseline.json` contains
only repository-relative paths and hashes; it does not contain the provider
payload.

## Preview and rerun proof

After the operator has inspected and approved the provider preview, and has
rerun the exact same input, validate the remaining two real artifacts:

```bash
node --experimental-strip-types scripts/heal-source.ts \
  --baseline evidence/healing/baseline.json \
  --preview evidence/raw/heal-preview.json \
  --after evidence/raw/heal-after.json \
  --output evidence/healing/proof.json
```

The proof is emitted only when the before, preview, and after artifacts carry
the exact same `c_*` Collector ID; any input URL in the artifacts matches the
fixed allowlisted URL; the preview has an exact top-level approval/preview
status; every after row passes `validateRawOffer`; and every listed downstream
file has the same hash as at baseline capture. Artifact SHA-256 hashes make
replacement or mutation visible without publishing raw provider output. If
post-heal validation fails, the proof command emits no success result and does
not modify the last-known-good catalog.

The output is an operator result, not live evidence by itself. Keep the matrix
row `pending` until a real authenticated create/heal/approve/rerun is captured,
reviewed for public-data eligibility, and the resulting sanitized proof is
approved for publication.
