import test from "node:test";
import assert from "node:assert/strict";
import { fingerprintRow, ingestRows } from "../lib/ingest.ts";
import { sourceRegistry } from "../config/sources.ts";

const rows = [
  {
    source_slug: "central-computer",
    market: "US",
    title: "ASUS RTX 5080 TUF 16GB",
    product_url: "https://www.centralcomputer.com/asus-rtx-5080/1",
    price: 2499,
    currency: "USD",
    availability: "available",
    scraped_at: "2026-08-22T03:00:00.000Z",
    sku: "ASU-5080-TUF",
    mpn: "TUF-RTX5080-O16G",
  },
  {
    source_slug: "central-computer",
    title: "broken row",
    product_url: "https://evil.example/broken",
    currency: "USD",
    availability: "available",
    scraped_at: "2026-08-22T03:00:00.000Z",
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
    scraped_at: "2026-08-22T03:00:00.000Z",
    sku: "JP-5080-1",
  }], { runId: "run-japan", observedAt: "2026-08-21T10:00:00.000Z", expectedSource: source.slug, source });
  assert.equal(result.summary.accepted, 1);
  assert.equal(result.summary.rejected, 0);
  assert.equal(result.offers[0].market, "JP");
  assert.equal(result.offers[0].currency, "JPY");
  assert.equal(result.offers[0].priceMinor, 189900);
});

test("Dynacore adapter rejection is quarantined with a safe reason and fingerprint", () => {
  const result = ingestRows([
    {
      source_slug: "dynacore",
      market: "SG",
      title: "ASUS ROG Herculx Graphics Card Holder",
      product_url: "https://dynacoretech.com/products/asus-rog-herculx-graphics-card-holder",
      price: { value: 89, currency: "SGD" },
      currency: "SGD",
      scraped_at: "2026-08-22T03:00:00.000Z",
    },
    {
      source_slug: "dynacore",
      market: "SG",
      title: "GIGABYTE RTX 5070 12GB",
      product_url: "https://dynacoretech.com/products/rtx-5070",
      price: { value: 1569, currency: "SGD" },
      currency: "SGD",
      availability: "unknown",
      sku: null,
      mpn: "RTX5070",
      manufacturer: "GIGABYTE",
      board_partner: "GIGABYTE",
      raw_model: "RTX5070",
      image_url: null,
      scraped_at: "2026-08-22T03:00:00.000Z",
    },
  ], {
    runId: "run-dynacore-adapter",
    observedAt: "2026-08-22T03:00:00.000Z",
    expectedSource: "dynacore",
    source: sourceRegistry.dynacore,
  });

  assert.equal(result.summary.accepted, 1);
  assert.equal(result.summary.rejected, 1);
  assert.equal(result.summary.duplicate, 0);
  assert.deepEqual(result.quarantined[0].reasonCodes, ["adapter_non_gpu_accessory"]);
  assert.match(result.quarantined[0].rowFingerprint, /^fnv1a-[0-9a-f]{8}$/);
});

test("Dynacore runtime rejects missing provider scraped_at", () => {
  const result = ingestRows([{
    source_slug: "dynacore",
    market: "SG",
    title: "GIGABYTE RTX 5070 12GB",
    product_url: "https://dynacoretech.com/products/rtx-5070",
    price: { value: 1569, currency: "SGD" },
    currency: "SGD",
    availability: "unknown",
    scraped_at: undefined,
  }], {
    runId: "run-dynacore-missing-timestamp",
    observedAt: "2026-08-22T03:00:00.000Z",
    expectedSource: "dynacore",
    source: sourceRegistry.dynacore,
  });
  assert.equal(result.summary.accepted, 0);
  assert.equal(result.summary.rejected, 1);
  assert.deepEqual(result.quarantined[0].reasonCodes, ["scraped_at_invalid"]);
});

test("Dynacore preserves original indexes when adapter and validator both quarantine rows", () => {
  const result = ingestRows([
    {
      source_slug: "dynacore",
      market: "SG",
      title: "ASUS ROG Herculx Graphics Card Holder",
      product_url: "https://dynacoretech.com/products/asus-rog-herculx-graphics-card-holder",
      price: { value: 89, currency: "SGD" },
      currency: "SGD",
      scraped_at: "2026-08-22T03:00:00.000Z",
    },
    {
      source_slug: "dynacore",
      market: "SG",
      title: "GIGABYTE RTX 5070 12GB",
      product_url: "https://evil.example/products/rtx-5070",
      price: { value: 1569, currency: "SGD" },
      currency: "SGD",
      availability: "unknown",
      scraped_at: "2026-08-22T03:00:00.000Z",
    },
  ], {
    runId: "run-dynacore-original-indexes",
    observedAt: "2026-08-22T03:00:00.000Z",
    expectedSource: "dynacore",
    source: sourceRegistry.dynacore,
  });
  assert.equal(result.summary.accepted, 0);
  assert.equal(result.summary.rejected, 2);
  assert.deepEqual(result.quarantined.map((row) => ({ index: row.rowIndex, reason: row.reasonCodes[0] })), [
    { index: 0, reason: "adapter_non_gpu_accessory" },
    { index: 1, reason: "url_not_allowed" },
  ]);
});

test("Infinity adapter quarantines non-GPU and call-for-price rows with original indexes", () => {
  const result = ingestRows([
    {
      category: "MONITOR",
      title: "Display",
      market: "SG",
      scraped_at: "2026-08-22T03:00:00.000Z",
    },
    {
      category: "GPU",
      market: "SG",
      title: "ASUS DUAL RTX 5060",
      canonical_product_url: "https://infinitycomputer.com.sg/product/rtx-5060",
      price_sgd: { value: null, currency: "SGD" },
      availability: "In Stock",
      sku: "SKU-5060",
      mpn: "MPN-5060",
      scraped_at: "2026-08-22T03:00:00.000Z",
    },
  ], {
    runId: "run-infinity-quarantine",
    observedAt: "2026-08-22T03:00:00.000Z",
    expectedSource: "infinity-computer",
    source: sourceRegistry["infinity-computer"],
  });
  assert.equal(result.summary.accepted, 0);
  assert.equal(result.summary.rejected, 2);
  assert.equal(result.summary.duplicate, 0);
  assert.deepEqual(result.quarantined.map((row) => ({ index: row.rowIndex, reason: row.reasonCodes[0] })), [
    { index: 0, reason: "adapter_non_gpu_category" },
    { index: 1, reason: "adapter_price_required" },
  ]);
  assert.match(result.quarantined[1].rowFingerprint, /^fnv1a-[0-9a-f]{8}$/);
});
