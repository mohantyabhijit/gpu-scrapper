import assert from "node:assert/strict";
import test from "node:test";
import { validateCollectorOutput } from "../scrapers/contracts.ts";
import { adaptInfinityOutput, computeInfinityBreadth } from "../scrapers/adapters/infinity-computer.ts";

const providerRow = (overrides = {}) => ({
  category: "GPU",
  source_slug: "infinity-computer",
  market: "SG",
  title: "ASUS DUAL RTX 5070 OC 12GB",
  canonical_product_url: "https://infinitycomputer.com.sg/product/rtx-5070",
  product_page_url: "https://infinitycomputer.com.sg/product/rtx-5070",
  price_sgd: { value: 1499, currency: "SGD" },
  availability: "In Stock",
  sku: "SKU-5070",
  mpn: "MPN-5070",
  raw_model: "RTX 5070",
  scraped_at: "2026-08-22T05:00:00.000Z",
  ...overrides,
});

test("Infinity adapter keeps exact GPU rows, numeric SGD prices, and original indexes", () => {
  const capture = adaptInfinityOutput([
    { category: "MONITOR", title: "Display", scraped_at: "2026-08-22T05:00:00.000Z" },
    providerRow({ price_sgd: null }),
    providerRow(),
  ]);

  assert.deepEqual(capture.rowIndexes, [2]);
  assert.equal(capture.evidence.source_card_count, 3);
  assert.equal(capture.evidence.gpu_card_count, 2);
  assert.equal(capture.evidence.excluded_category_count, 1);
  assert.equal(capture.evidence.price_required_count, 1);
  assert.equal(capture.evidence.accepted_row_count, 0);
  assert.equal(capture.payload.rows[0].price, 1499);
  assert.equal(capture.payload.rows[0].currency, "SGD");
  assert.equal(capture.payload.rows[0].availability, "in_stock");
  assert.deepEqual(capture.rejected.map((row) => ({ index: row.rowIndex, reason: row.reason })), [
    { index: 0, reason: "non_gpu_category" },
    { index: 1, reason: "price_required" },
  ]);
  assert.equal(validateCollectorOutput(capture.payload, "infinity-computer").ok, true);
});

test("Infinity adapter preserves provider source provenance for shared validation", () => {
  const capture = adaptInfinityOutput([providerRow({ source_slug: "other-source" })]);
  const validation = validateCollectorOutput(capture.payload, "infinity-computer");
  assert.equal(validation.ok, false);
  assert.equal(validation.errorCounts.unknown_source, 1);
});

test("Infinity call-for-price GPU rows are quarantined without fabricated prices", () => {
  const capture = adaptInfinityOutput([providerRow({ price_sgd: { value: null, currency: "SGD" } })]);
  assert.equal(capture.payload.rows.length, 0);
  assert.equal(capture.rejected[0].reason, "price_required");
  assert.equal(capture.evidence.price_required_count, 1);
});

test("Infinity breadth counts only validated rows and explicit cross-retailer identities", () => {
  const breadth = computeInfinityBreadth([
    { mpn: "RTX-5070-A", title: "GPU A" },
    { mpn: "RTX-5080-B", title: "GPU B" },
  ], [
    { mpn: "RTX-5070-A", title: "Other retailer GPU A" },
    { mpn: "RTX-5090-C", title: "Other retailer GPU C" },
  ]);
  assert.deepEqual(breadth, {
    validated_offer_count: 2,
    canonical_model_count: 2,
    cross_retailer_match_count: 1,
  });
});
