import test from "node:test";
import assert from "node:assert/strict";
import { marketCurrency, validateRawOffer } from "../scrapers/contracts.ts";
import { sourceRegistry } from "../config/sources.ts";

test("source registry is role keyed and contains no live collector IDs", () => {
  assert.equal(sourceRegistry["central-computer"].role, "primary");
  assert.equal(sourceRegistry["central-computer"].currency, "USD");
  assert.equal(Object.values(sourceRegistry).some((source) => source.collectorId), false);
});

test("contract accepts a public allowlisted offer", () => {
  const result = validateRawOffer({
    source_slug: "central-computer",
    market: "US",
    title: "ASUS GeForce RTX 5080 16GB GDDR7",
    product_url: "https://www.centralcomputer.com/asus-geforce-rtx-5080-16gb/best-deal/123",
    price: "24,999.00",
    currency: "USD",
    availability: "In Stock",
  });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.value.currency, "USD");
});

test("contract quarantines unknown hosts and missing prices", () => {
  const result = validateRawOffer({
    source_slug: "central-computer",
    market: "US",
    title: "RTX 5080",
    product_url: "https://evil.example/rtx-5080",
    currency: "USD",
    availability: "available",
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.deepEqual(result.errors, ["url_not_allowed", "price_required"]);
});

test("market currency mapping is fixed for the supported markets", () => {
  assert.equal(marketCurrency("US"), "USD");
  assert.equal(marketCurrency("UK"), "GBP");
  assert.equal(marketCurrency("IN"), "INR");
  assert.equal(marketCurrency("SG"), "SGD");
  assert.equal(marketCurrency("EUR"), undefined);
});

test("contract rejects a currency that does not belong to the declared market", () => {
  const result = validateRawOffer({
    source_slug: "central-computer",
    market: "US",
    title: "RTX 5080",
    product_url: "https://www.centralcomputer.com/graphics-card/5080",
    price: "2,499.00",
    currency: "GBP",
    availability: "available",
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.deepEqual(result.errors, ["currency_market_mismatch"]);
  }
});
