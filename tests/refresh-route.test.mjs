import test from "node:test";
import assert from "node:assert/strict";
import { handleRefreshRequest } from "../app/api/refresh/route.ts";
import {
  authenticateRefreshRequest,
  createRefreshRunner,
  parseRefreshRequest,
} from "../lib/brightdata/refresh.ts";

async function signature(secret, timestamp, body) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const bytes = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${body}`));
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function signedRequest(body, secret, timestamp = "1700000000") {
  return signature(secret, timestamp, body).then((signed) => new Request("https://raster.test/api/refresh", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-raster-timestamp": timestamp,
      "x-raster-signature": `sha256=${signed}`,
    },
    body,
  }));
}

test("HMAC auth accepts a current signature and rejects replay/tampering", async () => {
  const body = JSON.stringify({ sourceSlugs: ["central-computer"], role: "combined" });
  const timestamp = "1700000000";
  const signed = await signature("refresh-secret", timestamp, body);
  assert.equal(await authenticateRefreshRequest(timestamp, signed, body, "refresh-secret", 1700000000), true);
  assert.equal(await authenticateRefreshRequest(timestamp, signed, `${body} `, "refresh-secret", 1700000000), false);
  assert.equal(await authenticateRefreshRequest(timestamp, signed, body, "refresh-secret", 1700000401), false);
});

test("refresh input only accepts bounded registered sources and no URLs", () => {
  assert.deepEqual(parseRefreshRequest({ sourceSlugs: ["central-computer"], role: "combined" }), {
    sourceSlugs: ["central-computer"],
    role: "combined",
  });
  assert.throws(() => parseRefreshRequest({ sourceSlugs: ["central-computer", "central-computer"] }));
  assert.throws(() => parseRefreshRequest({ sourceSlugs: ["unknown"], role: "combined" }));
  assert.throws(() => parseRefreshRequest({ sourceSlugs: ["central-computer"], url: "https://evil.test" }));
});

test("route returns a sanitized not-configured response", async () => {
  const body = JSON.stringify({ sourceSlugs: ["central-computer"], role: "combined" });
  const request = await signedRequest(body, "refresh-secret");
  const response = await handleRefreshRequest(request, {
    environment: { RASTER_INGEST_HMAC_SECRET: "refresh-secret" },
    nowSeconds: 1700000000,
  });
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), {
    error: "bright_data_not_configured",
    requested: ["central-computer"],
  });
});

test("route uses an injected runner and returns no provider body", async () => {
  const body = JSON.stringify({ sourceSlugs: ["central-computer"], role: "combined" });
  const request = await signedRequest(body, "refresh-secret");
  const response = await handleRefreshRequest(request, {
    environment: {
      RASTER_INGEST_HMAC_SECRET: "refresh-secret",
      BRIGHTDATA_API_KEY: "provider-secret",
    },
    nowSeconds: 1700000000,
    runner: async () => ({
      requested: ["central-computer"],
      completed: [{ sourceSlug: "central-computer", collectorId: "c_demo", responseId: "r_demo", rowCount: 1, attempts: 1 }],
      notConfigured: [],
      failed: [],
    }),
  });
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.completed[0].rowCount, 1);
  assert.doesNotMatch(JSON.stringify(payload), /provider-secret/);
});

test("runner reports absent role-keyed collector IDs without a provider call", async () => {
  const run = createRefreshRunner({ BRIGHTDATA_API_KEY: "provider-secret" }, {
    fetchImpl: async () => {
      throw new Error("must not call provider");
    },
  });
  const result = await run({ sourceSlugs: ["central-computer"], role: "combined" });
  assert.deepEqual(result.notConfigured, ["central-computer"]);
  assert.deepEqual(result.completed, []);
});

test("runner preserves an honest not-configured result without an API key", async () => {
  const run = createRefreshRunner({});
  const result = await run({ sourceSlugs: ["central-computer"], role: "combined" });
  assert.deepEqual(result.notConfigured, ["central-computer"]);
  assert.deepEqual(result.failed, []);
});
