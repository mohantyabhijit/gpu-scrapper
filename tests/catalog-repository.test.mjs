import assert from "node:assert/strict";
import test from "node:test";
import { loadCatalog, mapD1Offer } from "../lib/d1/catalog.ts";

const validRow = {
  offerKey: "central-computer:rtx-5080-1",
  sourceSlug: "central-computer",
  offerMarket: "US",
  offerCurrency: "USD",
  title: "ASUS GeForce RTX 5080 16GB",
  productUrl: "https://www.centralcomputer.com/asus-rtx-5080/sku-1",
  priceMinor: 109999,
  availability: "in_stock",
  observedAt: "2026-08-21T10:00:00.000Z",
  health: "healthy",
  sourceMarket: "US",
  sourceCurrency: "USD",
  sourceDisplayName: "Central Computers",
  productSlug: "rtx-5080",
  productModel: "GeForce RTX 5080",
  boardPartner: "ASUS",
  vramGb: 16,
};

test("maps a normalized D1 row to one market-local storefront offer", () => {
  const offer = mapD1Offer(validRow);
  assert.ok(offer);
  assert.equal(offer.market, "us");
  assert.equal(offer.currency, "USD");
  assert.equal(offer.price, 1099.99);
  assert.equal(offer.brand, "ASUS");
  assert.equal(offer.vram, "16 GB VRAM");
  assert.match(offer.freshness, /live · observed 21 Aug 2026/);
  assert.equal(offer.freshnessTone, "fresh");
});

test("rejects cross-market currency and untrusted retailer rows", () => {
  assert.equal(mapD1Offer({ ...validRow, offerCurrency: "GBP" }), undefined);
  assert.equal(mapD1Offer({ ...validRow, productUrl: "https://evil.example/gpu" }), undefined);
  assert.equal(mapD1Offer({ ...validRow, sourceMarket: "UK" }), undefined);
});

test("loadCatalog uses injected D1 rows and reports real counts", async () => {
  const calls = [];
  const snapshot = await loadCatalog({
    market: "us",
    modelSlug: "rtx-5080",
    query: async (...args) => {
      calls.push(args);
      return [validRow];
    },
  });
  assert.equal(snapshot.source, "d1");
  assert.equal(snapshot.liveOfferCount, 1);
  assert.equal(snapshot.rejectedRows, 0);
  assert.equal(snapshot.offers[0].id, validRow.offerKey);
  assert.deepEqual(calls, [["us", "rtx-5080"]]);
});

test("loadCatalog falls back to fixtures when D1 is empty or unavailable", async () => {
  const empty = await loadCatalog({ query: async () => [] });
  assert.equal(empty.source, "fixture");
  assert.equal(empty.liveOfferCount, null);
  assert.equal(empty.fallbackReason, "database-empty");
  assert.ok(empty.offers.length > 0);

  const unavailable = await loadCatalog({ query: async () => { throw new Error("D1 unavailable"); } });
  assert.equal(unavailable.source, "fixture");
  assert.equal(unavailable.liveOfferCount, null);
  assert.equal(unavailable.fallbackReason, "database-unavailable");
});
