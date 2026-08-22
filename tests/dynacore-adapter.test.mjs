import assert from "node:assert/strict";
import test from "node:test";
import { adaptDynacoreOutput } from "../scrapers/adapters/dynacore.ts";
import { validateCollectorOutput } from "../scrapers/contracts.ts";

function providerRow(overrides = {}) {
  return {
    source_slug: "dynacore",
    market: "SG",
    title: "GIGABYTE GEFORCE RTX 5070 AORUS MASTER 12GB",
    product_url: "https://dynacoretech.com/products/rtx-5070",
    price: { value: 1569, currency: "SGD" },
    currency: "SGD",
    sku: "4719331355753",
    mpn: "GV-N507AORUSM-12GD",
    manufacturer: "GIGABYTE",
    board_partner: "AORUS",
    raw_model: "RTX5070 AORUS MASTER",
    image_url: "https://dynacoretech.com/cdn/shop/rtx-5070.jpg",
    scraped_at: "2026-08-22T02:20:00.000Z",
    product_page_url: "https://dynacoretech.com/products/rtx-5070",
    input: { url: "https://dynacoretech.com/collections/gpu" },
    ...overrides,
  };
}

test("Dynacore adapter maps provider price objects, defaults missing availability, and drops provider fields", () => {
  const capture = adaptDynacoreOutput([
    providerRow(),
    providerRow({ title: "ASUS ROG Herculx Graphics Card Holder - 195553206389", price: { value: 89, currency: "SGD" } }),
    providerRow({ title: "Gigabyte RTX 5070 Ti", availability: "In Stock" }),
  ], { collectorId: "c_dynacore_test" });

  assert.equal(capture.evidence.row_count, 3);
  assert.equal(capture.evidence.valid_rows, 2);
  assert.equal(capture.evidence.quarantined_rows, 1);
  assert.deepEqual(capture.rejected, [{ rowIndex: 1, reason: "non_gpu_accessory" }]);
  assert.equal(capture.payload.rows[0].price, 1569);
  assert.equal(capture.payload.rows[0].availability, "unknown");
  assert.equal(capture.payload.rows[1].availability, "in_stock");
  assert.equal("product_page_url" in capture.payload.rows[0], false);
  assert.equal("input" in capture.payload.rows[0], false);
  assert.equal(validateCollectorOutput(capture.payload, "dynacore").ok, true);
});

test("Dynacore adapter preserves invalid required fields for the shared validator to reject", () => {
  const capture = adaptDynacoreOutput([providerRow({ product_url: "https://evil.example/gpu", price: { value: 0 } })]);
  const validation = validateCollectorOutput(capture.payload, "dynacore");
  assert.equal(validation.ok, false);
  assert.equal(validation.errorCounts.url_not_allowed, 1);
  assert.equal(validation.errorCounts.price_invalid, 1);
});
