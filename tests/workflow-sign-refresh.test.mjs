import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { createPayload, parseSlice, runRefresh, signatureFor } from "../scripts/sign-refresh.mjs";
import { parseRefreshRequest } from "../lib/brightdata/refresh.ts";

test("refresh slices are allowlisted and role payloads stay deterministic", () => {
  assert.deepEqual(parseSlice("us-central-computer"), {
    market: "US",
    sourceSlug: "central-computer",
    slice: "us-central-computer",
  });
  assert.deepEqual(JSON.parse(createPayload({ market: "SG", sourceSlug: "dynacore" })), {
    sourceSlugs: ["dynacore"],
    role: "combined",
  });
  assert.throws(() => parseSlice("arbitrary-url"), /unsupported refresh slice/);
  assert.deepEqual(parseRefreshRequest(JSON.parse(createPayload(parseSlice("in-md-computers")))), {
    sourceSlugs: ["md-computers"],
    role: "combined",
  });
});

test("signature matches the documented timestamp.body HMAC", () => {
  const secret = "offline-test-secret-value";
  const timestamp = 1_700_000_000;
  const body = createPayload({ market: "US", sourceSlug: "central-computer" });
  const expected = `sha256=${createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex")}`;
  assert.equal(signatureFor({ secret, timestamp, body }), expected);
});

test("refresh sends one signed request and returns only safe response fields", async () => {
  let request;
  const summary = await runRefresh({
    url: "https://raster.example.test/api/refresh",
    slice: "uk-overclockers-uk",
    secret: "offline-test-secret-value",
    now: () => 1_700_000_000_000,
    fetchImpl: async (url, options) => {
      request = { url: String(url), options };
      return new Response(JSON.stringify({ requested: ["overclockers-uk"], completed: [{ rowCount: 4 }], notConfigured: [], failed: [], provider_key: "should-not-print" }), { status: 200 });
    },
  });
  assert.equal(request.url, "https://raster.example.test/api/refresh");
  assert.equal(request.options.method, "POST");
  assert.equal(request.options.headers["x-raster-timestamp"], "1700000000");
  assert.match(request.options.headers["x-raster-signature"], /^sha256=[0-9a-f]{64}$/);
  assert.equal(summary.ok, true);
  assert.equal(summary.requested, 1);
  assert.equal(summary.completed, 1);
  assert.equal(summary.not_configured, 0);
  assert.equal("provider_key" in summary, false);
});

test("refresh rejects non-HTTPS URLs and never exposes provider error bodies", async () => {
  await assert.rejects(
    runRefresh({ url: "http://raster.example.test/api/refresh", slice: "sg-dynacore", secret: "offline-test-secret-value" }),
    /refresh URL must use HTTPS/,
  );
  await assert.rejects(
    runRefresh({
      url: "https://raster.example.test/api/refresh",
      slice: "sg-dynacore",
      secret: "offline-test-secret-value",
      fetchImpl: async () => new Response(JSON.stringify({ error: "provider secret body" }), { status: 502 }),
    }),
    (error) => error instanceof Error && error.message === "refresh route returned HTTP 502" && !error.message.includes("provider secret"),
  );
});
