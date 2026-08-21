import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFile } from "node:fs/promises";
import { load as parseYaml } from "js-yaml";
import { createPayload, MAX_SUMMARY_INTEGER, MAX_TIMEOUT_MS, parseSlice, RefreshResponseError, runRefresh, signatureFor, summaryListLength } from "../scripts/sign-refresh.mjs";
import { MAX_PROVIDER_RUN_MS } from "../lib/brightdata/client.ts";
import { parseRefreshRequest } from "../lib/brightdata/refresh.ts";

const APPROVED_SECRET_STEP_NAMES = new Set([
  "Validate protected refresh inputs",
  "Trigger one market/source slice",
]);
const APPROVED_STEP_ENV = Object.freeze({
  RASTER_REFRESH_URL: "${{ secrets.RASTER_REFRESH_URL }}",
  RASTER_INGEST_HMAC_SECRET: "${{ secrets.RASTER_INGEST_HMAC_SECRET }}",
  RASTER_REFRESH_SLICE: "${{ matrix.slice }}",
});
const normalizeWorkflowValue = (value) => typeof value === "string" ? value.trim() : value;
const normalizeWorkflowExpression = (value) => normalizeWorkflowValue(value)?.replace(/\s+/g, " ");
const EXPECTED_REFRESH_IF = "${{ github.ref == 'refs/heads/main' && (github.event_name == 'schedule' || github.event_name == 'workflow_dispatch') }}";

function assertWorkflowExecutionPolicy(document) {
  assert.ok(document.on && typeof document.on === "object" && !Array.isArray(document.on), "workflow triggers must be a mapping");
  assert.deepEqual(Object.keys(document.on).sort(), ["schedule", "workflow_dispatch"], "workflow may trigger only on schedule or workflow_dispatch");
  assert.ok(document.jobs?.refresh && typeof document.jobs.refresh === "object", "refresh job must exist");
  assert.equal(document.jobs.refresh.environment, "raster-production", "refresh job must use the exact production environment");
  assert.equal(normalizeWorkflowExpression(document.jobs.refresh.if), normalizeWorkflowExpression(EXPECTED_REFRESH_IF), "refresh job must require the trusted main schedule/manual condition");
}

function assertWorkflowPolicy(workflow) {
  const document = parseYaml(workflow);
  assert.ok(document && typeof document === "object" && !Array.isArray(document), "workflow must be a YAML mapping");
  assert.deepEqual(document.permissions, { contents: "read" }, "workflow permissions must be contents: read only");
  assert.ok(document.jobs && typeof document.jobs === "object" && !Array.isArray(document.jobs), "workflow must define jobs");

  let approvedEnvBlocks = 0;
  let secretReferences = 0;
  const secretReference = /\$\{\{[\s\S]*?\bsecrets\b[\s\S]*?\}\}/;
  const scan = (value, allowed) => {
    if (typeof value === "string") {
      if (secretReference.test(value)) {
        secretReferences += 1;
        assert.equal(allowed, true, "secrets.* references must stay in approved step env blocks");
        assert.ok(Object.values(APPROVED_STEP_ENV).includes(normalizeWorkflowValue(value)), "secret references must use exact approved expressions");
      }
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) scan(item, allowed);
      return;
    }
    if (!value || typeof value !== "object") return;
    for (const child of Object.values(value)) scan(child, allowed);
  };

  for (const [key, value] of Object.entries(document)) {
    if (key !== "jobs") scan(value, false);
  }
  for (const [jobName, job] of Object.entries(document.jobs)) {
    assert.ok(job && typeof job === "object" && !Array.isArray(job), `${jobName} must be a mapping`);
    assert.deepEqual(job.permissions, { contents: "read" }, `${jobName} permissions must be contents: read only`);
    for (const [key, value] of Object.entries(job)) {
      if (key !== "steps") scan(value, false);
    }
    assert.ok(Array.isArray(job.steps), `${jobName} must define steps`);
    for (const step of job.steps) {
      assert.ok(step && typeof step === "object" && !Array.isArray(step), "workflow steps must be mappings");
      const approved = APPROVED_SECRET_STEP_NAMES.has(step.name);
      if (approved) {
        approvedEnvBlocks += 1;
        assert.ok(step.env && typeof step.env === "object" && !Array.isArray(step.env), `${step.name} must define an env mapping`);
        assert.deepEqual(Object.keys(step.env).sort(), Object.keys(APPROVED_STEP_ENV).sort(), `${step.name} env must contain only the approved mappings`);
        for (const [key, expected] of Object.entries(APPROVED_STEP_ENV)) {
          assert.equal(normalizeWorkflowValue(step.env[key]), expected, `${step.name} env.${key} must use the exact approved expression`);
        }
      }
      for (const [key, value] of Object.entries(step)) scan(value, approved && key === "env");
    }
  }
  assert.equal(approvedEnvBlocks, 2, "exactly two approved secret-bearing step env blocks are required");
  assert.equal(secretReferences, 4, "the two approved env blocks should contain only the four approved secret references");
  return document;
}

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

test("workflow schedules every baseline market as an independently locked slice", async () => {
  const workflow = await readFile(new URL("../.github/workflows/collect.yml", import.meta.url), "utf8");
  for (const slice of ["us-central-computer", "uk-overclockers-uk", "in-md-computers", "sg-dynacore"]) {
    assert.match(workflow, new RegExp(slice));
  }
  assert.match(workflow, /group: raster-refresh-\$\{\{ matrix\.slice \}\}/);
  assert.ok(MAX_TIMEOUT_MS >= MAX_PROVIDER_RUN_MS + 60_000);
});

test("workflow gates production secrets and pins deterministic setup", async () => {
  const workflow = await readFile(new URL("../.github/workflows/collect.yml", import.meta.url), "utf8");
  const document = parseYaml(workflow);
  assertWorkflowPolicy(workflow);
  assertWorkflowExecutionPolicy(document);
  assert.match(workflow, /timeout-minutes: (?:1[0-9]|[2-9][0-9])/);
  assert.match(workflow, /fail-fast: false/);
  assert.match(workflow, /cancel-in-progress: false/);
  assert.match(workflow, /actions\/setup-node@820762786026740c76f36085b0efc47a31fe5020/);
  assert.match(workflow, /node-version: 22\.13\.0/);
  assert.match(workflow, /npm ci --ignore-scripts/);

  const actionRefs = [...workflow.matchAll(/uses:\s+[^@]+@([^\s#]+)/g)].map((match) => match[1]);
  assert.ok(actionRefs.length > 0);
  for (const ref of actionRefs) assert.match(ref, /^[0-9a-f]{40}$/);

  const summary = workflow.slice(workflow.indexOf("- name: Publish safe job summary"));
  assert.doesNotMatch(summary, /secrets\./);
});

test("workflow execution policy rejects environment suffixes and weakened branch conditions", async () => {
  const workflow = await readFile(new URL("../.github/workflows/collect.yml", import.meta.url), "utf8");
  const environmentSuffix = workflow.replace("environment: raster-production", "environment: raster-production-preview");
  assert.throws(() => assertWorkflowExecutionPolicy(parseYaml(environmentSuffix)), /exact production environment/);

  const weakenedCondition = workflow.replace("github.ref == 'refs/heads/main'", "github.ref != 'refs/heads/main'");
  assert.throws(() => assertWorkflowExecutionPolicy(parseYaml(weakenedCondition)), /trusted main/);
  const pushTrigger = workflow.replace("on:\n  schedule:", "on:\n  push:\n  schedule:");
  assert.throws(() => assertWorkflowExecutionPolicy(parseYaml(pushTrigger)), /only on schedule/);
});

test("workflow policy catches inline job env secrets and tolerates reordered step env mappings", async () => {
  const workflow = await readFile(new URL("../.github/workflows/collect.yml", import.meta.url), "utf8");
  const reordered = workflow.replace(
    / {8}env:\n {10}RASTER_REFRESH_URL: \$\{\{ secrets\.RASTER_REFRESH_URL \}\}\n {10}RASTER_INGEST_HMAC_SECRET: \$\{\{ secrets\.RASTER_INGEST_HMAC_SECRET \}\}\n {10}RASTER_REFRESH_SLICE: \$\{\{ matrix\.slice \}\}/g,
    "        env:\n          RASTER_REFRESH_SLICE: ${{ matrix.slice }}\n          RASTER_INGEST_HMAC_SECRET: ${{ secrets.RASTER_INGEST_HMAC_SECRET }}\n          RASTER_REFRESH_URL: ${{ secrets.RASTER_REFRESH_URL }}",
  );
  assertWorkflowPolicy(reordered);

  const inlineJobEnv = reordered.replace(
    "  refresh:\n    if:",
    "  refresh:\n    env: { RASTER_REFRESH_URL: \"${{ secrets.RASTER_REFRESH_URL }}\" }\n    if:",
  );
  assert.throws(() => assertWorkflowPolicy(inlineJobEnv), /approved step env blocks/);
});

test("workflow policy rejects non-exact secret expressions even in approved envs", async () => {
  const workflow = await readFile(new URL("../.github/workflows/collect.yml", import.meta.url), "utf8");
  const bracketed = workflow
    .replaceAll("${{ secrets.RASTER_REFRESH_URL }}", "${{ secrets['RASTER_REFRESH_URL'] }}")
    .replaceAll("${{ secrets.RASTER_INGEST_HMAC_SECRET }}", '${{ secrets["RASTER_INGEST_HMAC_SECRET"] }}');
  assert.throws(() => assertWorkflowPolicy(bracketed), /exact approved expression/);
  assert.throws(() => assertWorkflowPolicy(workflow.replaceAll("${{ secrets.RASTER_REFRESH_URL }}", "${{ toJSON(secrets) }}")), /exact approved expression/);
  assert.throws(() => assertWorkflowPolicy(workflow.replaceAll("${{ secrets.RASTER_REFRESH_URL }}", "${{ secrets.RASTER_INGEST_HMAC_SECRET }}")), /exact approved expression/);

  const extraSecret = workflow.replaceAll(
    "          RASTER_REFRESH_SLICE: ${{ matrix.slice }}",
    "          RASTER_REFRESH_SLICE: ${{ matrix.slice }}\n          EXTRA_SECRET: ${{ secrets.RASTER_REFRESH_URL }}",
  );
  assert.throws(() => assertWorkflowPolicy(extraSecret), /only the approved mappings/);

  const leaks = [
    "LEAK: \"${{ secrets['RASTER_REFRESH_URL'] }}\"",
    'LEAK: \'${{ secrets["RASTER_REFRESH_URL"] }}\'',
    "LEAK: \"${{ toJSON(secrets) }}\"",
  ];
  for (const leak of leaks) {
    const outsideApprovedEnv = workflow.replace(
      "  refresh:\n    if:",
      `  refresh:\n    env:\n      ${leak}\n    if:`,
    );
    assert.throws(() => assertWorkflowPolicy(outsideApprovedEnv), /approved step env blocks/);
  }
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
  assert.equal(summary.status, "completed");
  assert.equal(summary.rows, 4);
  assert.deepEqual(summary.completed_sources, [{ source_slug: undefined, rows: 4, observed_at: undefined, attempts: undefined }]);
});

test("refresh rejects non-HTTPS URLs and never exposes provider error bodies", async () => {
  await assert.rejects(
    runRefresh({ url: "http://raster.example.test/api/refresh", slice: "sg-dynacore", secret: "offline-test-secret-value" }),
    /refresh URL must use HTTPS/,
  );
  let failure;
  try {
    await runRefresh({
      url: "https://raster.example.test/api/refresh",
      slice: "sg-dynacore",
      secret: "offline-test-secret-value",
      fetchImpl: async () => new Response(JSON.stringify({ error: "provider secret body" }), { status: 502 }),
    });
    assert.fail("expected a sanitized response error");
  } catch (error) {
    failure = error;
  }
  assert.ok(failure instanceof RefreshResponseError);
  assert.equal(failure.message, "refresh route returned HTTP 502");
  assert.equal(failure.summary.http_status, 502);
  assert.equal(failure.summary.error, "unknown_error");
  assert.doesNotMatch(JSON.stringify(failure.summary), /provider secret body/);
});

test("structured partial failures are bounded to safe slugs, codes, and counts", async () => {
  let failure;
  try {
    await runRefresh({
      url: "https://raster.example.test/api/refresh",
      slice: "uk-overclockers-uk",
      secret: "offline-test-secret-value",
      fetchImpl: async () => new Response(JSON.stringify({
        requested: ["overclockers-uk"],
        completed: [{ sourceSlug: "overclockers-uk", rowCount: 4, observedAt: "secret-observed-at", attempts: 2 }],
        notConfigured: [],
        failed: [{ sourceSlug: "overclockers-uk", code: "provider_secret_body", rawProviderBody: "Bearer super-secret-value" }],
        authorization: "Bearer super-secret-value",
      }), { status: 502 }),
    });
    assert.fail("expected a sanitized response error");
  } catch (error) {
    failure = error;
  }
  assert.ok(failure instanceof RefreshResponseError);
  const serialized = JSON.stringify(failure.summary);
  assert.doesNotMatch(serialized, /secret-observed-at|provider_secret_body|super-secret-value|rawProviderBody|authorization/i);
  assert.deepEqual(failure.summary.failures, [{ source_slug: "overclockers-uk", code: "unknown_error" }]);
  assert.equal(failure.summary.completed_sources[0].source_slug, "overclockers-uk");
  assert.equal(failure.summary.completed_sources[0].rows, 4);
  assert.equal(failure.summary.failed, 1);
});

test("structured summary list counts are capped", async () => {
  const oversized = [];
  oversized.length = MAX_SUMMARY_INTEGER + 1;
  assert.equal(summaryListLength(oversized), MAX_SUMMARY_INTEGER);
  assert.equal(summaryListLength("not-a-list"), undefined);

  const summary = await runRefresh({
    url: "https://raster.example.test/api/refresh",
    slice: "sg-dynacore",
    secret: "offline-test-secret-value",
    fetchImpl: async () => new Response(JSON.stringify({
      requested: ["one"],
      completed: [],
      notConfigured: [],
      failed: [],
    }), { status: 200 }),
  });
  assert.equal(summary.requested, 1);
  assert.ok(summary.requested <= MAX_SUMMARY_INTEGER);
  assert.ok(summary.completed <= MAX_SUMMARY_INTEGER);
  assert.ok(summary.not_configured <= MAX_SUMMARY_INTEGER);
  assert.ok(summary.failed <= MAX_SUMMARY_INTEGER);
});

test("fallback summary metrics accept only bounded non-negative integers", async () => {
  const metricKeys = ["rows", "valid_rows", "quarantined_rows", "duration_ms"];
  const secretShapedValues = [
    "Authorization: Bearer provider-token",
    "HMAC-SHA256=deadbeef",
    "RASTER_INGEST_HMAC_SECRET=super-secret-value",
    "123",
  ];
  for (const key of metricKeys) {
    for (const value of secretShapedValues) {
      const summary = await runRefresh({
        url: "https://raster.example.test/api/refresh",
        slice: "sg-dynacore",
        secret: "offline-test-secret-value",
        fetchImpl: async () => new Response(JSON.stringify({ [key]: value }), { status: 200 }),
      });
      assert.equal(Object.hasOwn(summary, key), false, `${key} must omit string values`);
      assert.doesNotMatch(JSON.stringify(summary), /Authorization|HMAC|secret|Bearer|provider-token/i);
    }
  }

  const summary = await runRefresh({
    url: "https://raster.example.test/api/refresh",
    slice: "sg-dynacore",
    secret: "offline-test-secret-value",
    fetchImpl: async () => new Response(JSON.stringify({
      rows: 0,
      valid_rows: MAX_SUMMARY_INTEGER,
      quarantined_rows: -1,
      duration_ms: MAX_SUMMARY_INTEGER + 1,
    }), { status: 200 }),
  });
  assert.equal(summary.rows, 0);
  assert.equal(summary.valid_rows, MAX_SUMMARY_INTEGER);
  assert.equal(Object.hasOwn(summary, "quarantined_rows"), false);
  assert.equal(Object.hasOwn(summary, "duration_ms"), false);
});

test("aborted refreshes fail with a bounded redacted error", async () => {
  await assert.rejects(
    runRefresh({
      url: "https://raster.example.test/api/refresh",
      slice: "sg-dynacore",
      secret: "offline-test-secret-value",
      timeoutMs: 1_000,
      fetchImpl: async (_url, { signal }) => new Promise((resolve, reject) => {
        signal.addEventListener("abort", () => reject(new Error("provider secret timeout body")), { once: true });
      }),
    }),
    (error) => error instanceof Error && error.message === "refresh request failed before a safe response was received",
  );
});
