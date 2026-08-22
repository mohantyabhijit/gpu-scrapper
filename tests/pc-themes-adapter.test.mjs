import test from "node:test";
import assert from "node:assert/strict";
import { adaptPcThemesOutput } from "../scrapers/adapters/pc-themes.ts";
import { validateCollectorOutput } from "../scrapers/contracts.ts";

function providerRow(overrides = {}) {
  return {
    source_slug: "pc-themes",
    market: "SG",
    currency: "SGD",
    title: "ASUS Prime GeForce RTX 5070 OC 12GB",
    product_url: "https://www.pcthemes.com.sg/asus-prime-geforce-rtx-5070-oc",
    price: "S$1,099.00",
    availability: "In Stock",
    sku: null,
    manufacturer: "ASUS",
    board_partner: "ASUS",
    raw_model: "RTX 5070",
    scraped_at: "2026-08-22T06:30:00.000Z",
    provider_only: "must not escape",
    ...overrides,
  };
}

test("PC Themes adapter emits the exact contract with numeric SGD and nullable metadata", () => {
  const capture = adaptPcThemesOutput([providerRow()]);

  assert.deepEqual(capture.rowIndexes, [0]);
  assert.deepEqual(capture.payload.rows[0], {
    source_slug: "pc-themes",
    market: "SG",
    title: "ASUS Prime GeForce RTX 5070 OC 12GB",
    product_url: "https://www.pcthemes.com.sg/asus-prime-geforce-rtx-5070-oc",
    price: 1099,
    currency: "SGD",
    availability: "in_stock",
    sku: null,
    mpn: null,
    manufacturer: "ASUS",
    board_partner: "ASUS",
    raw_model: "RTX 5070",
    image_url: null,
    scraped_at: "2026-08-22T06:30:00.000Z",
  });
  assert.equal(validateCollectorOutput(capture.payload, "pc-themes").ok, true);
});

test("PC Themes adapter quarantines accessories and missing prices with original indexes", () => {
  const capture = adaptPcThemesOutput([
    providerRow({ title: "Cooler Master Graphics Card Holder", price: 49 }),
    providerRow({ title: "Sapphire Radeon RX 9070 XT", price: null }),
    providerRow({ title: "Intel Arc B580", price: { value: 459, currency: "SGD" } }),
  ]);

  assert.deepEqual(capture.rowIndexes, [2]);
  assert.deepEqual(capture.rejected.map(({ rowIndex, reason }) => ({ rowIndex, reason })), [
    { rowIndex: 0, reason: "non_gpu_accessory" },
    { rowIndex: 1, reason: "price_required" },
  ]);
  assert.equal(capture.payload.rows[0].price, 459);
});

test("PC Themes adapter preserves invalid provenance for the shared validator", () => {
  const capture = adaptPcThemesOutput([
    providerRow({ product_url: "https://evil.example/rtx-5070", currency: "USD", scraped_at: undefined }),
  ]);
  const result = validateCollectorOutput(capture.payload, "pc-themes");

  assert.equal(result.ok, false);
  assert.equal(result.errorCounts.url_not_allowed, 1);
  assert.equal(result.errorCounts.currency_market_mismatch, 1);
  assert.equal(result.errorCounts.timestamp_invalid, 1);
});
