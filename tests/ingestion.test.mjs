import test from "node:test";
import assert from "node:assert/strict";
import { fingerprintRow, ingestRows } from "../lib/ingest.ts";

const rows = [
  {
    source_slug: "central-computer",
    market: "US",
    title: "ASUS RTX 5080 TUF 16GB",
    product_url: "https://www.centralcomputer.com/asus-rtx-5080/1",
    price: 2499,
    currency: "USD",
    availability: "available",
    sku: "ASU-5080-TUF",
    mpn: "TUF-RTX5080-O16G",
  },
  {
    source_slug: "central-computer",
    title: "broken row",
    product_url: "https://evil.example/broken",
    currency: "USD",
    availability: "available",
  },
];

test("ingestion is deterministic and quarantines invalid rows", () => {
  const context = { runId: "run-001", observedAt: "2026-08-21T10:00:00.000Z" };
  const first = ingestRows([...rows, rows[0]], context);
  const second = ingestRows([...rows, rows[0]], context);
  assert.deepEqual(first, second);
  assert.equal(first.summary.accepted, 1);
  assert.equal(first.summary.rejected, 1);
  assert.equal(first.summary.duplicate, 1);
  assert.equal(first.observations[0].observationKey, "run-001:central-computer:asu-5080-tuf");
  assert.equal(first.quarantined[0].reasonCodes.includes("url_not_allowed"), true);
});

test("row fingerprints are stable regardless of object key order", () => {
  assert.equal(
    fingerprintRow({ a: 1, b: "two" }),
    fingerprintRow({ b: "two", a: 1 }),
  );
});
