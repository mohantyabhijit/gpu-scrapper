import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createHealingBaseline, createHealingProof, HealingHarnessError } from "../lib/evidence/healing-harness.ts";

const manifest = {
  sourceSlug: "central-computer",
  collectorId: "c_raster_heal_01",
  inputUrl: "https://www.centralcomputer.com/all-products/hardware/video-cards/video-cards.html",
  requiredField: "price",
};

function row(overrides = {}) {
  return {
    source_slug: "central-computer",
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
  await mkdir(path.join(root, "src"), { recursive: true });
  await writeFile(path.join(root, "src", "consumer.ts"), "export const consumer = true;\n");
  return root;
}

async function writeArtifact(root, name, value) {
  const file = path.join(root, "evidence", "raw", name);
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`);
  return path.relative(root, file);
}

function beforeArtifact() {
  return {
    collector_id: manifest.collectorId,
    input_url: manifest.inputUrl,
    source_slug: manifest.sourceSlug,
    status: "completed",
    rows: [row({ price: undefined })],
  };
}

function previewArtifact() {
  return {
    collector_id: manifest.collectorId,
    input_url: manifest.inputUrl,
    source_slug: manifest.sourceSlug,
    status: "awaiting_approval",
    changed_fields: ["price"],
  };
}

function afterArtifact() {
  return {
    collector_id: manifest.collectorId,
    input_url: manifest.inputUrl,
    source_slug: manifest.sourceSlug,
    status: "completed",
    rows: [row()],
  };
}

test("same-ID harness produces deterministic hashes and proves consumers unchanged", async () => {
  const root = await fixtureRoot();
  const before = await writeArtifact(root, "before.json", beforeArtifact());
  const preview = await writeArtifact(root, "preview.json", previewArtifact());
  const after = await writeArtifact(root, "after.json", afterArtifact());
  const baseline = await createHealingBaseline({ ...manifest, repoRoot: root, beforePath: before, downstreamPaths: ["src/consumer.ts"] });
  const proof = await createHealingProof({ repoRoot: root, baseline, previewPath: preview, afterPath: after });

  assert.equal(proof.status, "passed");
  assert.equal(proof.collector_id, manifest.collectorId);
  assert.equal(proof.input_url, manifest.inputUrl);
  assert.equal(proof.before.contract, "failed");
  assert.equal(proof.after.contract, "passed");
  assert.equal(proof.after.valid_rows, 1);
  assert.equal(proof.downstream.unchanged, true);
  assert.equal(proof.downstream.files[0].beforeSha256, proof.downstream.files[0].afterSha256);
  assert.match(proof.before.sha256, /^[a-f0-9]{64}$/);
  assert.match(proof.preview.sha256, /^[a-f0-9]{64}$/);
  assert.match(proof.after.sha256, /^[a-f0-9]{64}$/);
  assert.deepEqual(await readFile(path.join(root, "src", "consumer.ts"), "utf8"), "export const consumer = true;\n");
});

test("baseline fails closed when the required field is not actually broken", async () => {
  const root = await fixtureRoot();
  const before = await writeArtifact(root, "before-valid.json", { ...beforeArtifact(), rows: [row()] });
  await assert.rejects(
    createHealingBaseline({ ...manifest, repoRoot: root, beforePath: before, downstreamPaths: ["src/consumer.ts"] }),
    (error) => error instanceof HealingHarnessError && /valid contract row|required field/.test(error.message),
  );
});

test("proof rejects changed Collector ID, input, and downstream consumer", async () => {
  const root = await fixtureRoot();
  const before = await writeArtifact(root, "before.json", beforeArtifact());
  const preview = await writeArtifact(root, "preview.json", previewArtifact());
  const after = await writeArtifact(root, "after.json", afterArtifact());
  const baseline = await createHealingBaseline({ ...manifest, repoRoot: root, beforePath: before, downstreamPaths: ["src/consumer.ts"] });

  await writeFile(path.join(root, "src", "consumer.ts"), "export const consumer = false;\n");
  await assert.rejects(createHealingProof({ repoRoot: root, baseline, previewPath: preview, afterPath: after }), /downstream consumer file changed/);

  await writeFile(path.join(root, "src", "consumer.ts"), "export const consumer = true;\n");
  await writeArtifact(root, "after-wrong-id.json", { ...afterArtifact(), collector_id: "c_other_collector" });
  await assert.rejects(createHealingProof({ repoRoot: root, baseline, previewPath: preview, afterPath: "evidence/raw/after-wrong-id.json" }), /exactly the expected Collector ID/);

  await writeArtifact(root, "preview-wrong-input.json", { ...previewArtifact(), input_url: "https://www.centralcomputer.com/other-public-page" });
  await assert.rejects(createHealingProof({ repoRoot: root, baseline, previewPath: "evidence/raw/preview-wrong-input.json", afterPath: after }), /fixed input URL/);
});

test("secret-bearing provider artifacts are rejected instead of sanitized into proof", async () => {
  const root = await fixtureRoot();
  const before = await writeArtifact(root, "secret-before.json", {
    ...beforeArtifact(),
    headers: { Authorization: "Bearer provider-token-that-must-never-be-read-as-proof" },
  });
  await assert.rejects(
    createHealingBaseline({ ...manifest, repoRoot: root, beforePath: before, downstreamPaths: ["src/consumer.ts"] }),
    (error) => error instanceof HealingHarnessError && /prohibited|secret material/.test(error.message),
  );
});
