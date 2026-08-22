import assert from "node:assert/strict";
import test from "node:test";
import { isProcurementReadyOffer } from "../app/catalog.ts";
import { classifyFreshness, loadCatalog, mapPostgresOffer } from "../lib/postgres/catalog.ts";

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
  sourceAllowedHosts: '["centralcomputer.com","www.centralcomputer.com"]',
  sourceEnabled: true,
  sourceOnboardingStatus: "ready",
  productSlug: "rtx-5080",
  productModel: "GeForce RTX 5080",
  boardPartner: "ASUS",
  vramGb: 16,
};

test("maps a normalized PostgreSQL row to one market-local storefront offer", () => {
  const offer = mapPostgresOffer(validRow, undefined, new Date("2026-08-21T12:00:00.000Z"));
  assert.ok(offer);
  assert.equal(offer.market, "us");
  assert.equal(offer.currency, "USD");
  assert.equal(offer.price, 1099.99);
  assert.equal(offer.brand, "ASUS");
  assert.equal(offer.vram, "16 GB VRAM");
  assert.equal(offer.observedAt, validRow.observedAt);
  assert.match(offer.freshness, /fresh · observed 21 Aug 2026, 10:00 UTC/);
  assert.equal(offer.freshnessState, "fresh");
  assert.equal(offer.healthState, "healthy");
  assert.equal(offer.freshnessTone, "fresh");
});

test("freshness uses explicit 24 and 48 hour UTC thresholds", () => {
  const now = new Date("2026-08-21T12:00:00.000Z");
  assert.equal(classifyFreshness("2026-08-20T12:00:00.000Z", now), "fresh");
  assert.equal(classifyFreshness("2026-08-20T11:59:59.999Z", now), "aging");
  assert.equal(classifyFreshness("2026-08-19T12:00:00.000Z", now), "aging");
  assert.equal(classifyFreshness("2026-08-19T11:59:59.999Z", now), "stale");
  assert.equal(classifyFreshness("2026-08-21T12:06:00.000Z", now), undefined);
});

test("availability and source health remain separate signals", () => {
  const now = new Date("2026-08-21T12:00:00.000Z");
  const unavailable = mapPostgresOffer({ ...validRow, availability: "out_of_stock" }, undefined, now);
  assert.equal(unavailable.availability, "Unavailable");
  assert.equal(unavailable.healthState, "healthy");
  assert.equal(unavailable.freshnessState, "fresh");

  const degraded = mapPostgresOffer({ ...validRow, health: "degraded", observedAt: "2026-08-19T10:00:00.000Z" }, undefined, now);
  assert.equal(degraded.availability, "In stock");
  assert.equal(degraded.healthState, "degraded");
  assert.equal(degraded.freshnessState, "stale");
  assert.match(degraded.note, /last-known-good/);
});

test("procurement-ready summaries exclude unknown, stale, and degraded observations", () => {
  const fresh = mapPostgresOffer(validRow, undefined, new Date("2026-08-21T12:00:00.000Z"));
  assert.equal(isProcurementReadyOffer(fresh), true);
  assert.equal(isProcurementReadyOffer({ ...fresh, availability: "Unknown" }), false);
  assert.equal(isProcurementReadyOffer({ ...fresh, freshnessState: "stale" }), false);
  assert.equal(isProcurementReadyOffer({ ...fresh, healthState: "degraded" }), false);
  assert.equal(isProcurementReadyOffer({ ...fresh, healthState: "fixture", freshnessState: "fixture" }), true);
});

test("rejects cross-market currency and untrusted retailer rows", () => {
  assert.equal(mapPostgresOffer({ ...validRow, offerCurrency: "GBP" }), undefined);
  assert.equal(mapPostgresOffer({ ...validRow, productUrl: "https://evil.example/gpu" }), undefined);
  assert.equal(mapPostgresOffer({ ...validRow, sourceMarket: "UK" }), undefined);
  assert.equal(mapPostgresOffer({ ...validRow, sourceEnabled: false }), undefined);
  assert.equal(mapPostgresOffer({ ...validRow, sourceOnboardingStatus: "pending" }), undefined);
});

test("loadCatalog uses injected PostgreSQL rows and reports real counts", async () => {
  const calls = [];
  const snapshot = await loadCatalog({
    market: "us",
    modelSlug: "rtx-5080",
    query: async (...args) => {
      calls.push(args);
      return [validRow];
    },
  });
  assert.equal(snapshot.source, "postgres");
  assert.equal(snapshot.liveOfferCount, 1);
  assert.equal(snapshot.rejectedRows, 0);
  assert.equal(snapshot.offers[0].id, validRow.offerKey);
  assert.equal(calls[0][0].code, "US");
  assert.equal(calls[0][0].currency, "USD");
  assert.equal(calls[0][1], "rtx-5080");
});

test("a ready runtime country merges with the four baseline markets and uses its country code", async () => {
  const calls = [];
  const japan = { slug: "japan", code: "JP", label: "Japan", currency: "JPY", locale: "ja-JP", symbol: "¥", enabled: true, ready: true };
  const dynamicRow = {
    ...validRow,
    sourceSlug: "example-japan",
    sourceDisplayName: "Example Japan",
    sourceAllowedHosts: '["example.jp"]',
    offerMarket: "JP",
    sourceMarket: "JP",
    offerCurrency: "JPY",
    sourceCurrency: "JPY",
    productUrl: "https://example.jp/gpus/5080",
    priceMinor: 18990000,
  };
  const snapshot = await loadCatalog({
    market: "japan",
    marketQuery: async () => [japan],
    query: async (...args) => { calls.push(args); return [dynamicRow]; },
  });
  assert.equal(snapshot.markets.length, 5);
  assert.equal(snapshot.selectedMarket.code, "JP");
  assert.equal(snapshot.offers[0].market, "japan");
  assert.equal(calls[0][0].currency, "JPY");
});

test("pending runtime countries stay in the ledger but not the selector", async () => {
  const pending = { slug: "australia", code: "AU", label: "Australia", currency: "AUD", locale: "en-AU", symbol: "A$", enabled: false, ready: false };
  const snapshot = await loadCatalog({ market: "australia", marketQuery: async () => [pending], query: async () => [] });
  assert.equal(snapshot.selectedMarket.slug, "us");
  assert.equal(snapshot.markets.some((market) => market.slug === "australia"), false);
  assert.equal(snapshot.marketPacks.some((market) => market.slug === "australia"), true);
});

test("loadCatalog falls back to fixtures when PostgreSQL is empty or unavailable", async () => {
  const empty = await loadCatalog({ query: async () => [] });
  assert.equal(empty.source, "fixture");
  assert.equal(empty.liveOfferCount, null);
  assert.equal(empty.fallbackReason, "database-empty");
  assert.ok(empty.offers.length > 0);

  const unavailable = await loadCatalog({ query: async () => { throw new Error("PostgreSQL unavailable"); } });
  assert.equal(unavailable.source, "fixture");
  assert.equal(unavailable.liveOfferCount, null);
  assert.equal(unavailable.fallbackReason, "database-unavailable");
});
