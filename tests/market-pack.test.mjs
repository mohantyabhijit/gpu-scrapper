import test from "node:test";
import assert from "node:assert/strict";
import { handleMarketPackRequest } from "../app/api/market-packs/route.ts";
import * as schema from "../db/schema.ts";
import { MarketPackValidationError, upsertMarketPack, validateMarketPack } from "../lib/postgres/market-packs.ts";
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

function fakeDb({ failTable } = {}) {
  const calls = [];
  const rows = { marketPacks: new Map(), sources: new Map() };
  const tableName = (table) => table === schema.marketPacks ? "marketPacks" : table === schema.sources ? "sources" : undefined;
  return {
    calls,
    rows,
    select() {
      return {
        from(table) {
          return {
            where() {
              return {
                limit() {
                  const name = tableName(table);
                  return Promise.resolve(name ? [...rows[name].values()] : []);
                },
                async get() {
                  const name = tableName(table);
                  return name ? rows[name].values().next().value : undefined;
                },
              };
            },
          };
        },
      };
    },
    insert(table) {
      return { values(value) {
        calls.push(value);
        let set = value;
        const statement = {
          onConflictDoUpdate(input) { set = input.set; calls.push(set); return statement; },
          async execute() {
            const name = tableName(table);
            if (!name) throw new Error("unknown fake table");
            if (name === failTable) throw new Error(`forced ${name} failure`);
            rows[name].set(value.slug, { ...value, ...set });
          },
          then(resolve, reject) { return statement.execute().then(resolve, reject); },
        };
        return statement;
      } };
    },
    async batch(statements) {
      calls.push(`batch:${statements.length}`);
      const snapshot = Object.fromEntries(Object.entries(rows).map(([name, values]) => [name, new Map(values)]));
      try {
        for (const statement of statements) await statement.execute();
      } catch (error) {
        for (const [name, values] of Object.entries(snapshot)) rows[name] = values;
        throw error;
      }
    },
    async transaction(callback) {
      const snapshot = Object.fromEntries(Object.entries(rows).map(([name, values]) => [name, new Map(values)]));
      try { return await callback(this); } catch (error) {
        for (const [name, values] of Object.entries(snapshot)) rows[name] = values;
        throw error;
      }
    },
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
  assert.throws(() => validateMarketPack({ ...valid, eligibilityEvidenceRef: "https://example.jp/token=secret" }), /eligibilityEvidenceRef/);
  assert.throws(() => validateMarketPack({ ...valid, collectorRunEvidenceRef: "evidence/../raw/run.json" }), /collectorRunEvidenceRef/);
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
  assert.equal(db.calls[0].enabled, false);
  assert.equal(db.rows.marketPacks.get("japan").countryCode, "JP");
  assert.equal(db.rows.sources.get("example-japan").onboardingStatus, "pending");
});

test("country and source admission rolls back when the source write fails", async () => {
  const db = fakeDb({ failTable: "sources" });
  await assert.rejects(
    upsertMarketPack(db, valid, new Date("2026-08-21T00:00:00Z")),
    /forced sources failure/,
  );
  assert.equal(db.rows.marketPacks.size, 0);
  assert.equal(db.rows.sources.size, 0);
});

test("an admitted Country Pack keeps its country, currency, and source binding", async () => {
  const db = fakeDb();
  await upsertMarketPack(db, valid, new Date("2026-08-21T00:00:00Z"));
  await assert.rejects(
    upsertMarketPack(db, { ...valid, sourceSlug: "replacement-japan" }, new Date("2026-08-21T00:01:00Z")),
    /immutable/,
  );
  assert.equal(db.rows.marketPacks.get("japan").sourceSlug, "example-japan");
  assert.equal(db.rows.sources.has("replacement-japan"), false);
});

test("a ready Country Pack cannot reuse evidence while swapping its collector boundary", async () => {
  const db = fakeDb();
  const ready = {
    ...valid,
    status: "ready",
    eligibilityEvidenceRef: "evidence/eligibility.md",
    eligibilityVerifiedAt: "2026-08-20",
    collectorCreatedEvidenceRef: "evidence/create.md",
    collectorCreatedAt: "2026-08-20",
    collectorRunEvidenceRef: "evidence/run.md",
    collectorRunAt: "2026-08-21",
  };
  await upsertMarketPack(db, ready, new Date("2026-08-21T00:00:00Z"));
  for (const mutation of [
    { collectorId: "c_replacement_gpu_02" },
    { catalogUrl: "https://example.jp/new-gpus" },
    { allowedHosts: ["example.jp", "catalog.example.jp"] },
    { sourceDisplayName: "Replacement Japan" },
  ]) {
    await assert.rejects(
      upsertMarketPack(db, { ...ready, ...mutation }, new Date("2026-08-21T00:01:00Z")),
      /ready collector and source metadata are immutable/,
    );
  }
  assert.equal(db.rows.marketPacks.get("japan").collectorId, valid.collectorId);
  assert.equal(db.rows.marketPacks.get("japan").catalogUrl, valid.catalogUrl);
});

test("route authenticates HMAC and does not echo provider evidence", async () => {
  const body = JSON.stringify({ ...valid, collectorRunEvidenceRef: "evidence/public/run-summary.json" });
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
  assert.doesNotMatch(JSON.stringify(payload), /run-summary/);
  const unauthorized = await handleMarketPackRequest(await request(body, "wrong-secret-long"), { environment: { RASTER_INGEST_HMAC_SECRET: "market-pack-secret" }, db, nowSeconds: 1700000000 });
  assert.equal(unauthorized.status, 401);
});

test("Country Pack route handles malformed, oversized, replayed, invalid, and database failures safely", async () => {
  const environment = { RASTER_INGEST_HMAC_SECRET: "market-pack-secret" };
  const malformed = "{";
  assert.equal((await handleMarketPackRequest(await request(malformed), { environment, nowSeconds: 1700000000 })).status, 400);

  const oversized = JSON.stringify({ ...valid, padding: "x".repeat(70_000) });
  assert.equal((await handleMarketPackRequest(await request(oversized), { environment, nowSeconds: 1700000000 })).status, 413);

  const body = JSON.stringify(valid);
  const replayed = await handleMarketPackRequest(await request(body), {
    environment, db: fakeDb(), nowSeconds: 1700000000, replayGuard: async () => false,
  });
  assert.equal(replayed.status, 409);
  assert.deepEqual(await replayed.json(), { error: "replayed_request" });

  let invalidReleases = 0;
  const invalid = await handleMarketPackRequest(await request(JSON.stringify({ ...valid, collectorId: "not-a-collector" })), {
    environment,
    db: fakeDb(),
    nowSeconds: 1700000000,
    replayGuard: async () => ({ acquired: true, complete: async () => {}, release: async () => { invalidReleases += 1; } }),
  });
  assert.equal(invalid.status, 400);
  assert.equal(invalidReleases, 1);

  let failureReleases = 0;
  const unavailable = await handleMarketPackRequest(await request(body), {
    environment,
    db: fakeDb({ failTable: "sources" }),
    nowSeconds: 1700000000,
    replayGuard: async () => ({ acquired: true, complete: async () => {}, release: async () => { failureReleases += 1; } }),
  });
  assert.equal(unavailable.status, 503);
  assert.deepEqual(await unavailable.json(), { error: "market_pack_unavailable" });
  assert.equal(failureReleases, 1);
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
