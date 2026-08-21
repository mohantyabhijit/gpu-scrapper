import test from "node:test";
import assert from "node:assert/strict";
import { createBrightDataClient, BrightDataError } from "../lib/brightdata/client.ts";

test("Bright Data client triggers and polls without exposing provider bodies", async () => {
  const calls = [];
  const responses = [
    new Response(JSON.stringify({ collection_id: "response-123" }), { status: 200 }),
    new Response(JSON.stringify({ status: "pending", secret: "do-not-return" }), { status: 202 }),
    new Response(JSON.stringify({ data: [{ title: "RTX 5080" }] }), { status: 200 }),
  ];
  const client = createBrightDataClient({
    apiKey: "test-api-key",
    baseUrl: "https://brightdata.test",
    pollIntervalMs: 0,
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return responses.shift();
    },
    sleep: async () => {},
  });

  const result = await client.triggerAndPoll({
    sourceSlug: "central-computer",
    collectorId: "c_demo",
    inputUrl: "https://www.centralcomputer.com/gpus",
  });
  assert.deepEqual(result.rows, [{ title: "RTX 5080" }]);
  assert.equal(result.attempts, 2);
  assert.equal(calls[0].url, "https://brightdata.test/dca/trigger?collector=c_demo");
  assert.equal(calls[1].url, "https://brightdata.test/dca/dataset?id=response-123");
  assert.equal(calls[0].init.headers.Authorization, "Bearer test-api-key");
  assert.deepEqual(JSON.parse(calls[0].init.body), [{ url: "https://www.centralcomputer.com/gpus" }]);
});

test("provider failures are sanitized", async () => {
  const client = createBrightDataClient({
    apiKey: "secret-key",
    fetchImpl: async () => new Response(JSON.stringify({ error: "secret-provider-body" }), { status: 500 }),
  });
  await assert.rejects(
    client.triggerAndPoll({
      sourceSlug: "central-computer",
      collectorId: "c_demo",
      inputUrl: "https://www.centralcomputer.com/gpus",
    }),
    (error) => {
      assert.equal(error instanceof BrightDataError, true);
      assert.equal(error.code, "provider_error");
      assert.doesNotMatch(error.message, /secret-provider-body|secret-key/);
      return true;
    },
  );
});

test("missing Bright Data keys fail honestly", () => {
  assert.throws(
    () => createBrightDataClient(),
    (error) => error instanceof BrightDataError && error.code === "not_configured",
  );
});

test("polling limits are bounded even when callers pass excessive values", async () => {
  let calls = 0;
  const client = createBrightDataClient({
    apiKey: "test-api-key",
    maxPollAttempts: 999,
    pollIntervalMs: 999_999,
    fetchImpl: async () => {
      calls += 1;
      return calls === 1
        ? new Response(JSON.stringify({ collection_id: "response-123" }), { status: 200 })
        : new Response(JSON.stringify({ status: "pending" }), { status: 202 });
    },
    sleep: async () => {},
  });
  await assert.rejects(
    client.triggerAndPoll({
      sourceSlug: "central-computer",
      collectorId: "c_demo",
      inputUrl: "https://www.centralcomputer.com/gpus",
    }),
    (error) => error instanceof BrightDataError && error.code === "timeout",
  );
  assert.equal(calls, 11);
});
