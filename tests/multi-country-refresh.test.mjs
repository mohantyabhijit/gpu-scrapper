import assert from "node:assert/strict";
import test from "node:test";
import { createPayload, runRefresh, signatureFor } from "../scripts/sign-refresh.mjs";
import { parseRefreshRequest } from "../lib/brightdata/refresh.ts";

test("a ready runtime country source can use the same bounded refresh signer", async () => {
  let sent;
  const summary = await runRefresh({
    url: "https://raster.example.test/scrapper/api/refresh",
    sourceSlug: "example-japan",
    secret: "offline-test-secret-value",
    now: () => 1_700_000_000_000,
    fetchImpl: async (url, options) => {
      sent = { url: String(url), options };
      return new Response(JSON.stringify({
        requested: ["example-japan"],
        completed: [{ sourceSlug: "example-japan", rowCount: 8, validRowCount: 8 }],
        notConfigured: [],
        failed: [],
      }), { status: 200 });
    },
  });

  assert.equal(sent.url, "https://raster.example.test/scrapper/api/refresh");
  assert.equal(sent.options.body, createPayload({ sourceSlug: "example-japan" }));
  assert.equal(summary.source_slug, "example-japan");
  assert.deepEqual(summary.completed_sources, [{
    source_slug: "example-japan",
    rows: 8,
    valid_rows: 8,
    observed_at: undefined,
    attempts: undefined,
  }]);
  await assert.rejects(
    runRefresh({
      url: "https://raster.example.test/scrapper/api/refresh",
      sourceSlug: "https://evil.example/collector",
      secret: "offline-test-secret-value",
    }),
    /source slug is invalid/,
  );
});

test("a pending Country Pack can run once through the operator-signed onboarding boundary", () => {
  const body = createPayload({ sourceSlug: "example-japan", onboardingPackSlug: "japan" });
  assert.deepEqual(JSON.parse(body), {
    sourceSlugs: ["example-japan"],
    role: "combined",
    onboardingPackSlug: "japan",
  });
  assert.deepEqual(parseRefreshRequest(JSON.parse(body)), {
    sourceSlugs: ["example-japan"],
    role: "combined",
    onboardingPackSlug: "japan",
  });
  assert.throws(
    () => parseRefreshRequest({ sourceSlugs: ["example-japan"], role: "combined", onboardingPackSlug: "bad_pack" }),
    /onboardingPackSlug is invalid/,
  );
});

test("the signed refresh plan returns only bounded ready source slugs", async () => {
  let planModule;
  try {
    planModule = await import("../scripts/fetch-refresh-plan.mjs");
  } catch {
    // The initial RED run proves the scheduler-side plan client does not exist yet.
  }
  assert.ok(planModule, "the scheduler needs a signed refresh-plan client");

  const { refreshPlanUrl, runRefreshPlan, validateRefreshPlan } = planModule;
  assert.equal(
    refreshPlanUrl("https://raster.example.test/scrapper/api/refresh"),
    "https://raster.example.test/scrapper/api/refresh-plan",
  );
  assert.deepEqual(validateRefreshPlan({ sourceSlugs: ["example-japan", "dynacore"], count: 2 }), ["dynacore", "example-japan"]);
  assert.throws(() => validateRefreshPlan({ sourceSlugs: ["https://evil.example"], count: 1 }), /refresh plan is invalid/);
  assert.throws(() => validateRefreshPlan({ sourceSlugs: ["dynacore"], count: 2 }), /refresh plan is invalid/);

  let sent;
  const sources = await runRefreshPlan({
    refreshUrl: "https://raster.example.test/scrapper/api/refresh",
    secret: "offline-test-secret-value",
    now: () => 1_700_000_000_000,
    fetchImpl: async (url, options) => {
      sent = { url: String(url), options };
      return new Response(JSON.stringify({ sourceSlugs: ["example-japan", "dynacore"], count: 2 }), { status: 200 });
    },
  });
  const body = JSON.stringify({ role: "combined" });
  assert.equal(sent.url, "https://raster.example.test/scrapper/api/refresh-plan");
  assert.equal(sent.options.method, "POST");
  assert.equal(sent.options.body, body);
  assert.equal(
    sent.options.headers["x-raster-signature"],
    signatureFor({ secret: "offline-test-secret-value", timestamp: 1_700_000_000, body }),
  );
  assert.deepEqual(sources, ["dynacore", "example-japan"]);
});
