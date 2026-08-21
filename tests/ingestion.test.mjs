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

test("a resolved runtime Country Pack accepts and normalizes its local currency", () => {
  const source = {
    slug: "example-japan",
    displayName: "Example Japan",
    role: "secondary",
    region: "JP",
    currency: "JPY",
    baseUrl: "https://example.jp/",
    allowedHosts: ["example.jp"],
    catalogUrl: "https://example.jp/gpus",
    enabled: true,
    collectorIds: { combined: "c_japan_gpu_01" },
    collectorRoles: ["combined"],
  };
  const result = ingestRows([{
    source_slug: source.slug,
    market: "JP",
    title: "ASUS GeForce RTX 5080 16GB",
    product_url: "https://example.jp/gpus/asus-5080",
    price: "189,900",
    currency: "JPY",
    availability: "in stock",
    sku: "JP-5080-1",
  }], { runId: "run-japan", observedAt: "2026-08-21T10:00:00.000Z", expectedSource: source.slug, source });
  assert.equal(result.summary.accepted, 1);
  assert.equal(result.summary.rejected, 0);
  assert.equal(result.offers[0].market, "JP");
  assert.equal(result.offers[0].currency, "JPY");
  assert.equal(result.offers[0].priceMinor, 189900);
});
