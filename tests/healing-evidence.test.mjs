import test from "node:test";
import assert from "node:assert/strict";
import {
  HealingEvidenceValidationError,
  HEALING_STAGES,
  nextHealingStage,
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
