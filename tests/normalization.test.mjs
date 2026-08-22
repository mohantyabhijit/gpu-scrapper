import test from "node:test";
import assert from "node:assert/strict";
import { validateRawOffer } from "../scrapers/contracts.ts";
import { canCompareOffers, comparableOffers, normalizeOffer, toMinorUnits } from "../lib/normalize/index.ts";

const valid = (overrides = {}) => {
  const result = validateRawOffer({
    source_slug: "central-computer",
    market: "US",
    title: "Gigabyte RTX 5080 Gaming OC 16GB",
    product_url: "https://www.centralcomputer.com/gigabyte-rtx-5080/sku-5080",
    price: "2,499.95",
    currency: "USD",
    availability: "in stock",
    scraped_at: "2026-08-22T03:00:00.000Z",
    mpn: "GV-N5080GAMING OC-16GD",
    ...overrides,
  });
  assert.equal(result.ok, true);
  return result.value;
};

test("prices are stored as currency minor units", () => {
  assert.equal(toMinorUnits("2,499.95", "USD"), 249995);
  assert.equal(toMinorUnits("12", "JPY"), 12);
});

test("MPN is preferred for stable cross-retailer identity", () => {
  const one = normalizeOffer(valid(), "2026-08-21T10:00:00.000Z");
  const two = normalizeOffer(valid({
    title: "Gigabyte Gaming OC GeForce RTX 5080 16 GB",
    product_url: "https://www.centralcomputer.com/gigabyte-rtx-5080/sku-5080-alt",
  }), "2026-08-21T10:00:00.000Z");
  assert.equal(one.product.identityKey, "mpn:GV-N5080GAMINGOC-16GD");
  assert.equal(one.product.identityKey, two.product.identityKey);
  assert.equal(one.priceMinor, 249995);
});

test("GPU identity ignores retailer trademark decoration", () => {
  const rtx = normalizeOffer(valid({
    title: "Gigabyte AORUS GeForce RTX™ 5070 Ti MASTER 16GB",
    mpn: null,
  }));
  const rx = normalizeOffer(valid({
    title: "ASUS Prime Radeon™ RX 9070 XT 16GB",
    mpn: null,
  }));
  assert.equal(rtx.product.model, "RTX 5070 TI");
  assert.equal(rtx.product.gpuFamily, "RTX");
  assert.equal(rx.product.model, "RX 9070 XT");
  assert.equal(rx.product.gpuFamily, "RX");
  assert.equal(normalizeOffer(valid({ title: "ASUS GeForce GT 730 2GB", mpn: null })).product.model, "GT 730");
});

test("comparisons are isolated by market and fixed currency", () => {
  const us = normalizeOffer(valid(), "2026-08-21T10:00:00.000Z");
  const sg = { ...us, offerKey: "sg:rtx-5080", market: "SG", currency: "SGD" };
  assert.equal(canCompareOffers(us, sg), false);
  assert.equal(canCompareOffers(us, { ...us, offerKey: "us:other" }), true);
  assert.equal(comparableOffers([us, sg], "US").length, 1);
  assert.equal(comparableOffers([us, sg], "SG").length, 1);
});
