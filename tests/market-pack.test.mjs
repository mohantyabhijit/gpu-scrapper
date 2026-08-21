import test from "node:test";
import assert from "node:assert/strict";
import { handleMarketPackRequest } from "../app/api/market-packs/route.ts";
import { MarketPackValidationError, upsertMarketPack, validateMarketPack } from "../lib/d1/market-packs.ts";
import { signatureFor, runMarketPack } from "../scripts/sign-market-pack.mjs";

const valid = {
  slug: "japan",
  countryCode: "JP",
  label: "Japan",
  currency: "JPY",
  locale: "ja-JP",
  symbol: "¥",
  sourceSlug: "example-japan",
  sourceDisplayName: "Example Japan",
  baseUrl: "https://example.jp",
  catalogUrl: "https://example.jp/gpus",
  allowedHosts: ["example.jp"],
  collectorId: "c_japan_gpu_01",
};

function fakeDb() {
  const calls = [];
  return {
    calls,
    insert() {
      return { values(value) { calls.push(value); return { onConflictDoUpdate({ set }) { calls.push(set); return { execute: async () => {} }; } }; } };
    },
    async batch(statements) { calls.push(`batch:${statements.length}`); for (const statement of statements) await statement.execute(); },
  };
}

async function request(body, secret = "market-pack-secret", timestamp = "1700000000") {
  const signed = signatureFor({ secret, timestamp: Number(timestamp), body });
  return new Request("https://raster.test/api/market-packs", {
    method: "POST",
    headers: { "x-raster-timestamp": timestamp, "x-raster-signature": signed },
    body,
  });
}

test("validates a pending pack and rejects unsafe onboarding fields", () => {
  const pending = validateMarketPack(valid, new Date("2026-08-21T00:00:00Z"));
  assert.equal(pending.slug, "japan");
  assert.equal(pending.status, "pending");
  assert.equal(pending.baseUrl, "https://example.jp/");
  assert.throws(() => validateMarketPack({ ...valid, catalogUrl: "https://evil.jp/gpus" }), MarketPackValidationError);
  assert.throws(() => validateMarketPack({ ...valid, collectorId: "collector-id" }), MarketPackValidationError);
  assert.throws(() => validateMarketPack({ ...valid, countryCode: "ZZ" }), MarketPackValidationError);
  assert.throws(() => validateMarketPack({ ...valid, allowedHosts: ["*.example.jp"] }), MarketPackValidationError);
  assert.throws(() => validateMarketPack({ ...valid, slug: "us", countryCode: "US" }), /baseline markets/);
  assert.throws(() => validateMarketPack({ ...valid, sourceSlug: "dynacore" }), /baseline sources/);
});

test("ready requires dated eligibility, creation, and run evidence", () => {
  assert.throws(() => validateMarketPack({ ...valid, status: "ready" }, new Date("2026-08-21T00:00:00Z")), /ready packs require/);
  const result = validateMarketPack({
    ...valid,
    status: "ready",
    eligibilityEvidenceRef: "evidence/eligibility.md",
    eligibilityVerifiedAt: "2026-08-20",
    collectorCreatedEvidenceRef: "evidence/create.md",
    collectorCreatedAt: "2026-08-20",
    collectorRunEvidenceRef: "evidence/run.md",
    collectorRunAt: "2026-08-21",
  }, new Date("2026-08-21T00:00:00Z"));
  assert.equal(result.status, "ready");
  assert.throws(() => validateMarketPack({
    ...valid,
    status: "ready",
    eligibilityEvidenceRef: "evidence/eligibility.md",
    eligibilityVerifiedAt: "2026-08-21",
    collectorCreatedEvidenceRef: "evidence/create.md",
    collectorCreatedAt: "2026-08-20",
    collectorRunEvidenceRef: "evidence/run.md",
    collectorRunAt: "2026-08-21",
  }, new Date("2026-08-21T00:00:00Z")), /eligibility evidence must predate/);
});

test("upsert atomically admits the market and its server-resolved source", async () => {
  const db = fakeDb();
  const result = await upsertMarketPack(db, valid, new Date("2026-08-21T00:00:00Z"));
  assert.deepEqual(result, { slug: "japan", countryCode: "JP", label: "Japan", currency: "JPY", locale: "ja-JP", symbol: "¥", sourceSlug: "example-japan", status: "pending" });
  assert.equal(db.calls.at(-1), "batch:2");
  assert.equal(db.calls[2].enabled, false);
});

test("route authenticates HMAC and does not echo provider evidence", async () => {
  const body = JSON.stringify({ ...valid, collectorRunEvidenceRef: "secret-provider-response" });
  const db = fakeDb();
  const response = await handleMarketPackRequest(await request(body), {
    environment: { RASTER_INGEST_HMAC_SECRET: "market-pack-secret" },
    db,
    nowSeconds: 1700000000,
    now: new Date("2026-08-21T00:00:00Z"),
    replayGuard: async () => true,
  });
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.deepEqual(payload, { slug: "japan", countryCode: "JP", label: "Japan", currency: "JPY", locale: "ja-JP", symbol: "¥", sourceSlug: "example-japan", status: "pending" });
  assert.doesNotMatch(JSON.stringify(payload), /secret-provider-response/);
  const unauthorized = await handleMarketPackRequest(await request(body, "wrong-secret-long"), { environment: { RASTER_INGEST_HMAC_SECRET: "market-pack-secret" }, db, nowSeconds: 1700000000 });
  assert.equal(unauthorized.status, 401);
});

test("signing helper emits only a safe response summary", async () => {
  const result = await runMarketPack({
    url: "https://raster.test/api/market-packs",
    packJson: JSON.stringify(valid),
    secret: "market-pack-secret",
    now: () => 1700000000000,
    fetchImpl: async (_url, init) => {
      assert.equal(init.headers["x-raster-signature"], signatureFor({ secret: "market-pack-secret", timestamp: 1700000000, body: JSON.stringify(valid) }));
      return new Response(JSON.stringify({ slug: "japan", status: "pending", collectorId: "provider-secret" }), { status: 200 });
    },
  });
  assert.deepEqual(result, { slug: "japan", status: "pending" });
});
