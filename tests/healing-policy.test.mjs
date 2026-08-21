import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { sourceRegistry } from "../config/sources.ts";
import { validateRawOffer } from "../scrapers/contracts.ts";
import {
  createHealingBaseline,
  createHealingProof,
  HealingHarnessError,
  REQUIRED_DOWNSTREAM_PATHS,
  resolveSafeOutputPath,
} from "../lib/evidence/healing-harness.ts";

const manifest = {
  sourceSlug: "central-computer",
  collectorId: "c_raster_heal_01",
  inputUrl: "https://www.centralcomputer.com/all-products/hardware/video-cards/video-cards.html",
  requiredField: "price",
};

const source = sourceRegistry[manifest.sourceSlug];
const originalSourceState = { enabled: source.enabled, collectorIds: { ...source.collectorIds } };
source.enabled = true;
source.collectorIds = { combined: manifest.collectorId };
test.after(() => {
  source.enabled = originalSourceState.enabled;
  source.collectorIds = originalSourceState.collectorIds;
});

function row(overrides = {}) {
  return {
    source_slug: manifest.sourceSlug,
    market: "US",
    title: "ASUS GeForce RTX 5080 16GB",
    product_url: "https://www.centralcomputer.com/graphics-card/rtx-5080",
    price: "1299.99",
    currency: "USD",
    availability: "In Stock",
    ...overrides,
  };
}

async function fixtureRoot() {
  const root = await mkdtemp(path.join(os.tmpdir(), "raster-healing-policy-"));
  await mkdir(path.join(root, "evidence", "raw"), { recursive: true });
  for (const file of REQUIRED_DOWNSTREAM_PATHS) {
    const target = path.join(root, file);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, `// stable ${file}\n`);
  }
  await writeFile(path.join(root, "catalog.json"), "last-known-good\n");
  return root;
}

async function writeArtifact(root, name, value) {
  const file = path.join(root, "evidence", "raw", name);
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`);
  return path.relative(root, file);
}

function beforeArtifact(overrides = {}) {
  return {
    collector_id: manifest.collectorId,
    input_url: manifest.inputUrl,
    source_slug: manifest.sourceSlug,
    status: "completed",
    response_id: "before-run-001",
    rows: [row({ price: undefined })],
    ...overrides,
  };
}

function previewArtifact(overrides = {}) {
  return {
    collector_id: manifest.collectorId,
    input_url: manifest.inputUrl,
    source_slug: manifest.sourceSlug,
    status: "awaiting_approval",
    response_id: "preview-run-001",
    rows: [],
    changed_fields: ["price"],
    ...overrides,
  };
}

function afterArtifact(overrides = {}) {
  return {
    collector_id: manifest.collectorId,
    input_url: manifest.inputUrl,
    source_slug: manifest.sourceSlug,
    status: "completed",
    response_id: "after-run-001",
    rows: [row()],
    ...overrides,
  };
}

async function baselineFor(root, before = beforeArtifact(), downstream = REQUIRED_DOWNSTREAM_PATHS) {
  const beforePath = await writeArtifact(root, "before.json", before);
  return createHealingBaseline({
    ...manifest,
    repoRoot: root,
    beforePath,
    downstreamPaths: downstream,
  });
}

test("same-ID envelope proves recovery and every downstream consumer stays unchanged", async () => {
  const root = await fixtureRoot();
  const baseline = await baselineFor(root);
  const preview = await writeArtifact(root, "preview.json", previewArtifact());
  const after = await writeArtifact(root, "after.json", afterArtifact());
  const proof = await createHealingProof({ repoRoot: root, baseline, previewPath: preview, afterPath: after });

  assert.equal(proof.status, "passed");
  assert.equal(proof.collector_id, manifest.collectorId);
  assert.equal(proof.before.contract, "failed");
  assert.equal(proof.after.contract, "passed");
  assert.equal(proof.after.valid_rows, 1);
  assert.equal(proof.downstream.files.length, REQUIRED_DOWNSTREAM_PATHS.length);
  assert.ok(proof.downstream.files.every((file) => file.beforeSha256 === file.afterSha256));
});

test("baseline fails when the selected field is not actually broken or availability is absent", async () => {
  const root = await fixtureRoot();
  await assert.rejects(baselineFor(root, beforeArtifact({ rows: [row()] })), /valid contract row|required field/);
  const result = validateRawOffer(row({ availability: undefined, stock: undefined }));
  assert.equal(result.ok, false);
  if (!result.ok) assert.ok(result.errors.includes("availability_invalid"));
});

test("preview accepts only exact positive top-level statuses", async () => {
  const rejected = ["approval_denied", "not_ready", "failed", "pending", "row approved"];
  for (const status of rejected) {
    const root = await fixtureRoot();
    const baseline = await baselineFor(root);
    const preview = await writeArtifact(root, "preview.json", previewArtifact({ status }));
    const after = await writeArtifact(root, "after.json", afterArtifact());
    await assert.rejects(createHealingProof({ repoRoot: root, baseline, previewPath: preview, afterPath: after }), /top-level preview status/);
  }
  const root = await fixtureRoot();
  const baseline = await baselineFor(root);
  const preview = await writeArtifact(root, "preview.json", {
    ...previewArtifact({ status: undefined }),
    rows: [{ status: "approved" }],
  });
  const after = await writeArtifact(root, "after.json", afterArtifact());
  await assert.rejects(createHealingProof({ repoRoot: root, baseline, previewPath: preview, afterPath: after }), /top-level status/);
});

test("after requires successful status and non-secret response/run identity", async () => {
  for (const overrides of [
    { status: "failed" },
    { status: "completed_with_errors" },
    { response_id: undefined, run_id: undefined },
    { response_id: "" },
    { rows: [] },
  ]) {
    const root = await fixtureRoot();
    const baseline = await baselineFor(root);
    const preview = await writeArtifact(root, "preview.json", previewArtifact());
    const after = await writeArtifact(root, "after.json", afterArtifact(overrides));
    await assert.rejects(createHealingProof({ repoRoot: root, baseline, previewPath: preview, afterPath: after }), /successful|response\/run identity|recovered rows/);
  }
});

test("root arrays and every malformed row member are rejected", async () => {
  const root = await fixtureRoot();
  const before = await writeArtifact(root, "before.json", [row({ price: undefined })]);
  await assert.rejects(createHealingBaseline({ ...manifest, repoRoot: root, beforePath: before, downstreamPaths: REQUIRED_DOWNSTREAM_PATHS }), /capture envelope/);
  for (const malformed of [null, "scalar", 42, [row({ price: undefined })]]) {
    const malformedRoot = await fixtureRoot();
    await assert.rejects(
      baselineFor(malformedRoot, beforeArtifact({ rows: [row({ price: undefined }), malformed] })),
      /row 1 must be an object/,
    );
  }
});

test("Collector ID must be enabled and registry-configured", async () => {
  const root = await fixtureRoot();
  source.collectorIds = { combined: "c_other_registered" };
  await assert.rejects(baselineFor(root), /not configured/);
  source.collectorIds = { combined: manifest.collectorId };
  source.enabled = false;
  await assert.rejects(baselineFor(root), /not enabled/);
  source.enabled = true;
});

test("incomplete downstream baselines are rejected", async () => {
  const root = await fixtureRoot();
  await assert.rejects(baselineFor(root, beforeArtifact(), REQUIRED_DOWNSTREAM_PATHS.slice(0, -1)), /baseline is incomplete/);
});

test("failed post-heal validation does not replace the last-known-good catalog", async () => {
  const root = await fixtureRoot();
  const baseline = await baselineFor(root);
  const preview = await writeArtifact(root, "preview.json", previewArtifact());
  const after = await writeArtifact(root, "after.json", afterArtifact({ rows: [row({ availability: undefined })] }));
  await assert.rejects(createHealingProof({ repoRoot: root, baseline, previewPath: preview, afterPath: after }), /shared contract|required field/);
  assert.equal(await readFile(path.join(root, "catalog.json"), "utf8"), "last-known-good\n");
});

test("output path policy rejects traversal, symlink traversal, symlink targets, and secret-like names", async () => {
  const root = await fixtureRoot();
  await assert.rejects(resolveSafeOutputPath(root, "evidence/../outside.json"), /lexical traversal/);
  await assert.rejects(resolveSafeOutputPath(root, "evidence/healing/provider-token.json"), /secret material/);
  const outside = await mkdtemp(path.join(os.tmpdir(), "raster-healing-outside-"));
  await symlink(outside, path.join(root, "evidence", "outside-link"));
  await assert.rejects(resolveSafeOutputPath(root, "evidence/outside-link/proof.json"), /outside|does not exist/);
  const target = path.join(root, "evidence", "raw", "target.json");
  const link = path.join(root, "evidence", "raw", "link.json");
  await writeFile(target, "{}\n");
  await symlink(target, link);
  await assert.rejects(resolveSafeOutputPath(root, "evidence/raw/link.json"), /regular file|symlink/);
});

test("secret-bearing provider artifacts are rejected instead of sanitized into proof", async () => {
  const root = await fixtureRoot();
  await assert.rejects(
    baselineFor(root, beforeArtifact({ headers: { Authorization: "Bearer provider-token-that-must-never-be-read-as-proof" } })),
    (error) => error instanceof HealingHarnessError && /prohibited|secret material/.test(error.message),
  );
});
