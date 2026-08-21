import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "../db/schema.ts";
import {
  HealingEvidenceValidationError,
  HEALING_STAGES,
  loadLatestHealingSession,
  nextHealingStage,
  recordHealingEvent,
  validateHealingEvent,
} from "../lib/d1/healing-evidence.ts";
import { handleHealEvidenceRequest } from "../app/api/heal-evidence/route.ts";
import { runHealEvent, signatureFor } from "../scripts/sign-heal-event.mjs";

const healthy = {
  sessionId: "heal-example-japan-20260821",
  sourceSlug: "example-japan",
  collectorId: "c_japan_gpu_01",
  stage: "healthy",
  occurredAt: "2026-08-21T08:00:00.000Z",
  evidenceRef: "evidence/heal/japan/01-healthy.json",
  detail: "Baseline contract passed with two accepted offers.",
  acceptedCount: 2,
};

function healRequest(body, secret = "heal-evidence-secret", timestamp = "1700000000") {
  return new Request("https://raster.test/api/heal-evidence", {
    method: "POST",
    headers: {
      "x-raster-timestamp": timestamp,
      "x-raster-signature": signatureFor({ secret, timestamp: Number(timestamp), body }),
    },
    body,
  });
}

async function realHealingDatabase() {
  const sqlite = new DatabaseSync(":memory:");
  for (const migration of [
    "0000_cuddly_kylun.sql",
    "0001_mute_ted_forrester.sql",
    "0002_eager_prodigy.sql",
    "0003_light_mandrill.sql",
    "0004_giant_madame_masque.sql",
    "0005_freeze_ready_country_pack.sql",
  ]) sqlite.exec(await readFile(new URL(`../drizzle/${migration}`, import.meta.url), "utf8"));
  const prepared = (sql) => ({
    bind(...params) {
      const statement = sqlite.prepare(sql);
      return {
        async first(column) {
          const row = statement.get(...params);
          return column && row ? row[column] : row;
        },
        async all() { return { results: statement.all(...params), success: true, meta: {} }; },
        async run() { statement.run(...params); return { success: true, meta: {} }; },
        async raw() { return statement.all(...params).map((row) => Object.values(row)); },
      };
    },
  });
  const d1 = {
    prepare: prepared,
    async batch(statements) { return Promise.all(statements.map((statement) => statement.run())); },
    async exec(sql) { sqlite.exec(sql); return { count: 0, duration: 0 }; },
  };
  return { sqlite, db: drizzle(d1, { schema }) };
}

test("healing stages encode the complete same-ID demonstration", () => {
  assert.deepEqual(HEALING_STAGES, [
    "healthy", "broken", "quarantined", "previewed", "approved", "rerun", "published",
  ]);
  assert.equal(nextHealingStage([]), "healthy");
  assert.equal(nextHealingStage(["healthy", "broken"]), "quarantined");
  assert.equal(nextHealingStage(HEALING_STAGES), undefined);
});

test("validates sanitized event evidence and stage-specific counts", () => {
  const parsed = validateHealingEvent(healthy, new Date("2026-08-21T09:00:00.000Z"));
  assert.equal(parsed.stage, "healthy");
  assert.equal(parsed.acceptedCount, 2);
  assert.throws(() => validateHealingEvent({ ...healthy, evidenceRef: "../.env" }), HealingEvidenceValidationError);
  assert.throws(() => validateHealingEvent({ ...healthy, evidenceRef: "https://example.com/token=secret" }), HealingEvidenceValidationError);
  assert.throws(() => validateHealingEvent({ ...healthy, collectorId: "collector-1" }), HealingEvidenceValidationError);
  assert.throws(() => validateHealingEvent({ ...healthy, stage: "rerun", acceptedCount: 0 }), /acceptedCount/);
  assert.throws(() => validateHealingEvent({ ...healthy, occurredAt: "2026-08-21T10:00:00.000Z" }, new Date("2026-08-21T09:00:00.000Z")), /occurredAt/);
});

test("rejects impossible, duplicated, and out-of-order transitions", () => {
  assert.equal(nextHealingStage(["healthy"]), "broken");
  assert.throws(() => nextHealingStage(["broken"]), HealingEvidenceValidationError);
  assert.throws(() => nextHealingStage(["healthy", "healthy"]), HealingEvidenceValidationError);
  assert.throws(() => nextHealingStage(["healthy", "quarantined"]), HealingEvidenceValidationError);
});

test("persists and reloads a complete same-ID healing session in SQLite", async () => {
  const { sqlite, db } = await realHealingDatabase();
  sqlite.exec("INSERT INTO sources(slug,display_name,market,region,currency,base_url,role,allowed_hosts,catalog_url,collector_ids,onboarding_status,enabled) VALUES('example-japan','Example Japan','JP','JP','JPY','https://example.jp/','secondary','[\"example.jp\"]','https://example.jp/gpus','{\"combined\":\"c_japan_gpu_01\"}','ready',1)");
  const baseTime = Date.parse("2026-08-21T08:00:00.000Z");
  for (const [index, stage] of HEALING_STAGES.entries()) {
    const result = await recordHealingEvent(db, {
      ...healthy,
      stage,
      occurredAt: new Date(baseTime + index * 60_000).toISOString(),
      evidenceRef: `evidence/heal/japan/${index + 1}-${stage}.json`,
      detail: `${stage} evidence recorded.`,
      ...(["healthy", "rerun", "published"].includes(stage) ? { acceptedCount: 2 } : { acceptedCount: 0 }),
    }, new Date("2026-08-21T09:00:00.000Z"));
    assert.equal(result.stage, stage);
    assert.equal(result.complete, index === HEALING_STAGES.length - 1);
  }

  const session = await loadLatestHealingSession(db);
  assert.equal(session.sessionId, healthy.sessionId);
  assert.equal(session.collectorId, healthy.collectorId);
  assert.equal(session.events.length, 7);
  assert.equal(session.events.at(-1).stage, "published");
  assert.equal(session.complete, true);
  assert.equal(session.nextStage, undefined);
  await assert.rejects(recordHealingEvent(db, healthy, new Date("2026-08-21T09:00:00.000Z")), /already complete/);

  sqlite.exec("INSERT INTO sources(slug,display_name,market,region,currency,base_url,collector_ids,onboarding_status,enabled) VALUES('pending-source','Pending','JP','JP','JPY','https://pending.example/','{\"combined\":\"c_pending_01\"}','pending',0)");
  await assert.rejects(recordHealingEvent(db, { ...healthy, sessionId: "heal-pending-20260821", sourceSlug: "pending-source", collectorId: "c_pending_01" }, new Date("2026-08-21T09:00:00.000Z")), /source must be ready/);
  await assert.rejects(recordHealingEvent(db, { ...healthy, sessionId: "heal-wrong-collector-20260821", collectorId: "c_wrong_01" }, new Date("2026-08-21T09:00:00.000Z")), /does not match/);
});

test("heal evidence route authenticates, blocks replay, and returns a safe summary", async () => {
  const body = JSON.stringify(healthy);
  const timestamp = "1700000000";
  const secret = "heal-evidence-secret";
  const makeRequest = (signature = signatureFor({ secret, timestamp: Number(timestamp), body })) => new Request("https://raster.test/api/heal-evidence", {
    method: "POST",
    headers: { "x-raster-timestamp": timestamp, "x-raster-signature": signature },
    body,
  });
  let recorded;
  const response = await handleHealEvidenceRequest(makeRequest(), {
    environment: { RASTER_INGEST_HMAC_SECRET: secret },
    nowSeconds: 1700000000,
    now: new Date("2026-08-21T09:00:00.000Z"),
    replayGuard: async () => true,
    db: {},
    recordEvent: async (_db, input) => {
      recorded = input;
      return { sessionId: healthy.sessionId, stage: "healthy", nextStage: "broken", complete: false };
    },
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { sessionId: healthy.sessionId, stage: "healthy", nextStage: "broken", complete: false });
  assert.deepEqual(recorded, healthy);

  const replayed = await handleHealEvidenceRequest(makeRequest(), {
    environment: { RASTER_INGEST_HMAC_SECRET: secret },
    nowSeconds: 1700000000,
    replayGuard: async () => false,
    db: {},
    recordEvent: async () => assert.fail("replayed request must not record evidence"),
  });
  assert.equal(replayed.status, 409);

  const unauthorized = await handleHealEvidenceRequest(makeRequest("sha256=" + "0".repeat(64)), {
    environment: { RASTER_INGEST_HMAC_SECRET: secret },
    nowSeconds: 1700000000,
  });
  assert.equal(unauthorized.status, 401);
});

test("heal evidence route bounds input and releases failed or incomplete claims", async () => {
  const environment = { RASTER_INGEST_HMAC_SECRET: "heal-evidence-secret" };
  const oversizedBody = JSON.stringify({ padding: "x".repeat(33 * 1024) });
  assert.equal((await handleHealEvidenceRequest(healRequest(oversizedBody), { environment })).status, 413);

  const malformedBody = "{";
  assert.equal((await handleHealEvidenceRequest(healRequest(malformedBody), { environment, nowSeconds: 1700000000 })).status, 400);

  const body = JSON.stringify(healthy);
  let validationReleases = 0;
  const invalid = await handleHealEvidenceRequest(healRequest(body), {
    environment,
    db: {},
    nowSeconds: 1700000000,
    replayGuard: async () => ({ acquired: true, complete: async () => {}, release: async () => { validationReleases += 1; } }),
    recordEvent: async () => { throw new HealingEvidenceValidationError("next healing stage must be broken"); },
  });
  assert.equal(invalid.status, 400);
  assert.deepEqual(await invalid.json(), { error: "next healing stage must be broken" });
  assert.equal(validationReleases, 1);

  let databaseReleases = 0;
  const unavailable = await handleHealEvidenceRequest(healRequest(body), {
    environment,
    db: {},
    nowSeconds: 1700000000,
    replayGuard: async () => ({ acquired: true, complete: async () => {}, release: async () => { databaseReleases += 1; } }),
    recordEvent: async () => { throw new Error("private database detail"); },
  });
  assert.equal(unavailable.status, 503);
  assert.deepEqual(await unavailable.json(), { error: "heal_evidence_unavailable" });
  assert.equal(databaseReleases, 1);

  let completionReleases = 0;
  const incomplete = await handleHealEvidenceRequest(healRequest(body), {
    environment,
    db: {},
    nowSeconds: 1700000000,
    replayGuard: async () => ({ acquired: true, complete: async () => { throw new Error("private completion detail"); }, release: async () => { completionReleases += 1; } }),
    recordEvent: async () => ({ sessionId: healthy.sessionId, stage: "healthy", nextStage: "broken", complete: false }),
  });
  assert.equal(incomplete.status, 503);
  assert.deepEqual(await incomplete.json(), { error: "heal_evidence_unavailable" });
  assert.equal(completionReleases, 1);
});

test("heal evidence signer refuses to transmit privileged signatures over HTTP", async () => {
  let calls = 0;
  await assert.rejects(
    runHealEvent({
      url: "http://raster.test/api/heal-evidence",
      eventJson: JSON.stringify(healthy),
      secret: "heal-evidence-secret",
      fetchImpl: async () => { calls += 1; throw new Error("must not send"); },
    }),
    /must use HTTPS/,
  );
  assert.equal(calls, 0);
});
