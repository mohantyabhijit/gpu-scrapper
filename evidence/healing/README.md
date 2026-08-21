# Same-ID healing evidence harness

The operator harness is an offline validator for the eventual live
Scraper Studio capture. It never calls Bright Data, approves a collector, or
creates evidence from a missing input. The three provider JSON files must be
real, locally captured artifacts; raw files stay under the ignored
`evidence/raw/` directory.

## Before capture

Run the health check after a controlled live break has produced a failing
provider artifact. The source and URL are checked against the source registry,
and the selected required field must be absent while the shared Raster
contract rejects every row. At least one downstream consumer file is required
so the later proof can compare its SHA-256 hash.

```bash
node --experimental-strip-types scripts/check-source-health.ts \
  --source central-computer \
  --collector c_REPLACE_WITH_REAL_ID \
  --input-url https://www.centralcomputer.com/all-products/hardware/video-cards/video-cards.html \
  --required-field price \
  --before evidence/raw/heal-before.json \
  --consumer scrapers/contracts.ts \
  --consumer lib/ingest.ts \
  --output evidence/healing/baseline.json
```

The command fails closed when an artifact is missing, malformed, outside the
allowlisted host, contains credential-shaped material, has another Collector
ID, or does not demonstrate the selected contract failure. `baseline.json`
contains only repository-relative paths and hashes; it does not contain the
provider payload.

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
fixed allowlisted URL; the preview has an approval/preview status; every after
row passes `validateRawOffer`; and every listed downstream file has the same
hash as at baseline capture. Artifact SHA-256 hashes make replacement or
mutation visible without publishing raw provider output.

The output is an operator result, not live evidence by itself. Keep the matrix
row `pending` until a real authenticated create/heal/approve/rerun is captured,
reviewed for public-data eligibility, and the resulting sanitized proof is
approved for publication.
