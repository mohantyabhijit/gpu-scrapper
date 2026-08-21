import test from "node:test";
import assert from "node:assert/strict";
import { handleRefreshRequest } from "../app/api/refresh/route.ts";
import {
  authenticateRefreshRequest,
  createRefreshRunner,
  parseRefreshRequest,
} from "../lib/brightdata/refresh.ts";
import { ingestRows } from "../lib/ingest.ts";
import { sourceRegistry } from "../config/sources.ts";

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

const validRow = {
  source_slug: "central-computer",
  market: "US",
  title: "ASUS GeForce RTX 5080 16GB",
  product_url: "https://www.centralcomputer.com/asus-rtx-5080/sku-1",
  price: "1,099.99",
  currency: "USD",
  availability: "in stock",
  sku: "ASUS-5080-1",
  mpn: "TUF-RTX5080-O16G",
};

const invalidRow = {
  source_slug: "central-computer",
  market: "US",
  title: "not a public catalog row",
  product_url: "https://not-allowed.example/item",
  currency: "USD",
  availability: "available",
};

function configureCentralComputer() {
  const source = sourceRegistry["central-computer"];
  const original = { enabled: source.enabled, collectorIds: source.collectorIds };
  source.enabled = true;
  source.collectorIds = { combined: "c_demo" };
  return () => {
    source.enabled = original.enabled;
    source.collectorIds = original.collectorIds;
  };
}

function mockProvider(rows) {
  let calls = 0;
  return async () => {
    calls += 1;
    return calls === 1
      ? new Response(JSON.stringify({ collection_id: "response-live-like" }), { status: 200 })
      : new Response(JSON.stringify({ data: rows }), { status: 200 });
  };
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
  assert.deepEqual(parseRefreshRequest({ sourceSlugs: ["custom-retailer"], role: "combined" }), {
    sourceSlugs: ["custom-retailer"],
    role: "combined",
  });
  assert.throws(() => parseRefreshRequest({ sourceSlugs: ["https://evil.test"], role: "combined" }));
  assert.throws(() => parseRefreshRequest({ sourceSlugs: ["bad_slug"], role: "combined" }));
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
    replayGuard: async () => true,
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

test("runner resolves a custom runtime source without accepting collector or URL input", async () => {
  const source = {
    ...sourceRegistry["central-computer"],
    slug: "custom-retailer",
    displayName: "Custom Retailer",
    baseUrl: "https://custom-retailer.example",
    allowedHosts: ["custom-retailer.example"],
    catalogUrl: "https://custom-retailer.example/gpus",
    enabled: true,
    collectorIds: { combined: "c_custom" },
  };
  const run = createRefreshRunner({ BRIGHTDATA_API_KEY: "provider-secret" }, {
    fetchImpl: mockProvider([{
      ...validRow,
      source_slug: "custom-retailer",
      product_url: "https://custom-retailer.example/rtx-5080/1",
    }]),
    pollIntervalMs: 0,
    sleep: async () => {},
  }, {
    resolveSource: async (slug) => slug === "custom-retailer" ? source : undefined,
    onComplete: async (input) => {
      assert.equal(input.source.slug, "custom-retailer");
      const result = ingestRows(input.rows, {
        runId: input.runId,
        observedAt: input.observedAt,
        expectedSource: input.sourceSlug,
        source: input.source,
      });
      assert.equal(result.offers.length, 1);
    },
  });
  const result = await run({ sourceSlugs: ["custom-retailer"], role: "combined" });
  assert.equal(result.completed[0].collectorId, "c_custom");
});

test("runner preserves an honest not-configured result without an API key", async () => {
  const run = createRefreshRunner({});
  const result = await run({ sourceSlugs: ["central-computer"], role: "combined" });
  assert.deepEqual(result.notConfigured, ["central-computer"]);
  assert.deepEqual(result.failed, []);
});

test("completed live-like rows reach the injected ingestion boundary with safe run metadata", async () => {
  const restore = configureCentralComputer();
  try {
    const completed = [];
    const run = createRefreshRunner({ BRIGHTDATA_API_KEY: "provider-secret" }, {
      fetchImpl: mockProvider([validRow]),
      pollIntervalMs: 0,
      sleep: async () => {},
    }, {
      now: () => new Date("2026-08-21T10:00:00.000Z"),
      onComplete: async (input) => {
        const result = ingestRows(input.rows, {
          runId: input.runId,
          observedAt: input.observedAt,
          expectedSource: input.sourceSlug,
        });
        completed.push({ input, result });
      },
    });
    const result = await run({ sourceSlugs: ["central-computer"], role: "combined" });
    assert.equal(result.completed.length, 1);
    assert.match(result.completed[0].runId, /^run-central-computer-response-live-like-/);
    assert.equal(result.completed[0].observedAt, "2026-08-21T10:00:00.000Z");
    assert.equal(completed[0].result.offers.length, 1);
    assert.equal(completed[0].result.quarantined.length, 0);
  } finally {
    restore();
  }
});

test("completed rows quarantine invalid output before persistence", async () => {
  const restore = configureCentralComputer();
  try {
    let persisted;
    const run = createRefreshRunner({ BRIGHTDATA_API_KEY: "provider-secret" }, {
      fetchImpl: mockProvider([validRow, invalidRow]),
      pollIntervalMs: 0,
      sleep: async () => {},
    }, {
      now: () => new Date("2026-08-21T10:01:00.000Z"),
      onComplete: async (input) => {
        persisted = ingestRows(input.rows, {
          runId: input.runId,
          observedAt: input.observedAt,
          expectedSource: input.sourceSlug,
        });
      },
    });
    const result = await run({ sourceSlugs: ["central-computer"], role: "combined" });
    assert.equal(result.completed[0].rowCount, 2);
    assert.equal(persisted.offers.length, 1);
    assert.equal(persisted.quarantined.length, 1);
    assert.deepEqual(result.failed, []);
  } finally {
    restore();
  }
});

test("persistence failures become a sanitized source error", async () => {
  const restore = configureCentralComputer();
  try {
    const run = createRefreshRunner({ BRIGHTDATA_API_KEY: "provider-secret" }, {
      fetchImpl: mockProvider([validRow]),
      pollIntervalMs: 0,
      sleep: async () => {},
    }, {
      onComplete: async () => {
        throw new Error("D1 provider body secret");
      },
    });
    const result = await run({ sourceSlugs: ["central-computer"], role: "combined" });
    assert.deepEqual(result.completed, []);
    assert.deepEqual(result.failed, [{ sourceSlug: "central-computer", code: "persistence_error" }]);
    assert.doesNotMatch(JSON.stringify(result), /provider body secret|provider-secret/);
  } finally {
    restore();
  }
});

test("route sanitizes an unexpected persistence exception", async () => {
  const body = JSON.stringify({ sourceSlugs: ["central-computer"], role: "combined" });
  const request = await signedRequest(body, "refresh-secret");
  const response = await handleRefreshRequest(request, {
    environment: {
      RASTER_INGEST_HMAC_SECRET: "refresh-secret",
      BRIGHTDATA_API_KEY: "provider-secret",
    },
    nowSeconds: 1700000000,
    replayGuard: async () => true,
    runner: async () => {
      throw new Error("D1 provider body secret");
    },
  });
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: "refresh_unavailable" });
});

test("route releases a claimed receipt after failure so the signed request can be retried", async () => {
  const body = JSON.stringify({ sourceSlugs: ["central-computer"], role: "combined" });
  const request = await signedRequest(body, "refresh-secret");
  let releases = 0;
  const response = await handleRefreshRequest(request, {
    environment: {
      RASTER_INGEST_HMAC_SECRET: "refresh-secret",
      BRIGHTDATA_API_KEY: "provider-secret",
    },
    nowSeconds: 1700000000,
    replayGuard: async () => ({
      acquired: true,
      release: async () => { releases += 1; },
    }),
    runner: async () => {
      throw new Error("transient provider failure");
    },
  });
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: "refresh_unavailable" });
  assert.equal(releases, 1);
});

test("route retains a claimed receipt after success", async () => {
  const body = JSON.stringify({ sourceSlugs: ["central-computer"], role: "combined" });
  const request = await signedRequest(body, "refresh-secret");
  let releases = 0;
  const response = await handleRefreshRequest(request, {
    environment: {
      RASTER_INGEST_HMAC_SECRET: "refresh-secret",
      BRIGHTDATA_API_KEY: "provider-secret",
    },
    nowSeconds: 1700000000,
    replayGuard: async () => ({
      acquired: true,
      release: async () => { releases += 1; },
    }),
    runner: async () => ({
      requested: ["central-computer"],
      completed: [{ sourceSlug: "central-computer", collectorId: "c_demo", responseId: "r_demo", rowCount: 1, attempts: 1 }],
      notConfigured: [],
      failed: [],
    }),
  });
  assert.equal(response.status, 200);
  assert.equal(releases, 0);
});

test("route releases a claimed receipt when every source reports a transient failure", async () => {
  const body = JSON.stringify({ sourceSlugs: ["central-computer"], role: "combined" });
  const request = await signedRequest(body, "refresh-secret");
  let releases = 0;
  const response = await handleRefreshRequest(request, {
    environment: {
      RASTER_INGEST_HMAC_SECRET: "refresh-secret",
      BRIGHTDATA_API_KEY: "provider-secret",
    },
    nowSeconds: 1700000000,
    replayGuard: async () => ({
      acquired: true,
      release: async () => { releases += 1; },
    }),
    runner: async () => ({
      requested: ["central-computer"],
      completed: [],
      notConfigured: [],
      failed: [{ sourceSlug: "central-computer", code: "provider_error" }],
    }),
  });
  assert.equal(response.status, 502);
  assert.equal(releases, 1);
});

test("route rejects an oversized body before authentication or provider execution", async () => {
  const body = JSON.stringify({ sourceSlugs: ["central-computer"], role: "combined", padding: "x".repeat(9_000) });
  const request = await signedRequest(body, "refresh-secret");
  let runs = 0;
  const response = await handleRefreshRequest(request, {
    environment: {
      RASTER_INGEST_HMAC_SECRET: "refresh-secret",
      BRIGHTDATA_API_KEY: "provider-secret",
    },
    nowSeconds: 1700000000,
    replayGuard: async () => true,
    runner: async () => { runs += 1; throw new Error("must not run"); },
  });
  assert.equal(response.status, 413);
  assert.deepEqual(await response.json(), { error: "request_too_large" });
  assert.equal(runs, 0);
});

test("route rejects an authenticated replay before provider execution", async () => {
  const body = JSON.stringify({ sourceSlugs: ["central-computer"], role: "combined" });
  const request = await signedRequest(body, "refresh-secret");
  let runs = 0;
  const response = await handleRefreshRequest(request, {
    environment: { RASTER_INGEST_HMAC_SECRET: "refresh-secret", BRIGHTDATA_API_KEY: "provider-secret" },
    nowSeconds: 1700000000,
    replayGuard: async () => false,
    runner: async () => { runs += 1; throw new Error("must not run"); },
  });
  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), { error: "replayed_request" });
  assert.equal(runs, 0);
});
