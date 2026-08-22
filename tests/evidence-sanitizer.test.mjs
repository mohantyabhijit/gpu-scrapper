import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sanitizeEvidence } from "../scripts/sanitize-evidence.mjs";

const sanitizerPath = fileURLToPath(new URL("../scripts/sanitize-evidence.mjs", import.meta.url));

const secretShapedRunFixture = {
  collector_id: "c_demo123",
  status: "completed",
  target_url: "https://retailer.example/gpus?api_key=fake-query-value",
  headers: {
    Authorization: "Bearer fake-provider-token",
    "x-api-key": "fake-api-key",
  },
  provider_error_body: "fake provider body must not be published",
  error: { body: "fake raw error body", stack: "fake stack" },
    rows: Array.from({ length: 8 }, (_, index) => ({
    title: `GPU ${index + 1}`,
    product_url: `https://retailer.example/gpu-${index + 1}?token=fake-row-token`,
    price: 1000 + index,
    currency: "usd",
    availability: "in stock",
      observed_at: "2026-08-21T00:00:00Z",
      scraped_at: "2026-08-21T00:00:00Z",
    raw_html: "fake raw provider markup",
    row_secret: "fake-row-secret",
  })),
};

test("run evidence removes secrets and caps public row samples", () => {
  const summary = sanitizeEvidence(secretShapedRunFixture, {
    kind: "run",
    sourceFile: "/tmp/run.json",
    generatedAt: "2026-08-21T01:02:03Z",
  });
  const serialized = JSON.stringify(summary);

  assert.deepEqual(summary.collector_ids, ["c_demo123"]);
  assert.equal(summary.status, "completed");
  assert.equal(summary.target_url, "https://retailer.example/gpus");
  assert.equal(summary.sample_rows.length, 5);
  assert.equal(summary.redactions.sample_rows_seen, 8);
  assert.equal(summary.redactions.provider_payloads_omitted, true);
  assert.equal(summary.sample_rows[0].currency, "USD");
  assert.equal(summary.sample_rows[0].scraped_at, "2026-08-21T00:00:00Z");
  assert.equal(summary.sample_rows[0].sku, null);
  assert.equal(summary.sample_rows[0].image_url, null);
  assert.equal("raw_html" in summary.sample_rows[0], false);
  assert.equal("row_secret" in summary.sample_rows[0], false);
  assert.doesNotMatch(serialized, /fake-provider-token|fake-api-key|fake provider body|fake raw error body|fake-row-secret|fake-row-token/);
});

test("run evidence retains safe source binding, labelled counts, and processing results", () => {
  const summary = sanitizeEvidence({
    collector_id: "c_dynacore123",
    target_url: "https://dynacoretech.com/collections/gpu",
    catalog_url: "https://dynacoretech.com/collections/gpu",
    source_slug: "dynacore",
    market: "SG",
    currency: "SGD",
    manifest_name: "scrapers/manifests/dynacore.json",
    scraper_name: "raster-sg-dynacore-gpus",
    adapter_result: "passed",
    validator_result: "passed",
    source_card_count: 3,
    adapted_row_count: 2,
    accepted_row_count: 2,
    quarantined_row_count: 1,
    rows: [{ title: "GPU", scraped_at: "2026-08-21T00:00:00Z" }],
  }, { kind: "run", generatedAt: "2026-08-21T01:02:03Z" });

  assert.deepEqual(summary.source_binding, {
    source_slug: "dynacore",
    market: "SG",
    currency: "SGD",
    manifest_name: "scrapers/manifests/dynacore.json",
    scraper_name: "raster-sg-dynacore-gpus",
    target_url: "https://dynacoretech.com/collections/gpu",
    catalog_url: "https://dynacoretech.com/collections/gpu",
  });
  assert.deepEqual(summary.processing, { adapter_result: "passed", validator_result: "passed" });
  assert.deepEqual(summary.counts, { source_cards: 3, adapted_rows: 2, accepted_rows: 2, quarantined_rows: 1 });
  assert.equal(summary.sample_rows[0].scraped_at, "2026-08-21T00:00:00Z");
  assert.equal(summary.sample_rows[0].sku, null);
});

test("create and heal evidence retain only collector identity and safe status", () => {
  const input = {
    collectorId: "c_create123",
    status: "created",
    targetUrl: "https://retailer.example/catalog?secret=fake",
    apiToken: "fake-create-token",
    responseBody: { secret: "fake-response-secret", collectorId: "c_create123" },
  };
  const createSummary = sanitizeEvidence(input, { kind: "create", generatedAt: "2026-08-21T01:02:03Z" });
  const healSummary = sanitizeEvidence({
    before: input,
    after: { collectorId: "c_create123", status: "healed", authorization: "Bearer fake-heal-token" },
    provider_error: "fake-heal-provider-error",
  }, { kind: "heal", generatedAt: "2026-08-21T01:02:03Z" });

  assert.deepEqual(createSummary.collector_ids, ["c_create123"]);
  assert.deepEqual(healSummary.collector_ids, ["c_create123"]);
  assert.equal(createSummary.status, "created");
  assert.equal(healSummary.status, "reported");
  assert.equal(createSummary.target_url, "https://retailer.example/catalog");
  assert.doesNotMatch(JSON.stringify(createSummary), /fake-create-token|fake-response-secret/);
  assert.doesNotMatch(JSON.stringify(healSummary), /fake-heal-token|fake-heal-provider-error/);
});

test("public catalog and input URLs are preserved without query credentials", () => {
  const summary = sanitizeEvidence({
    collectorId: "c_catalog123",
    inputUrl: "https://retailer.example/catalog?api_key=fake-input-key",
    catalogUrl: "https://retailer.example/gpus?token=fake-catalog-token",
  }, { kind: "create", generatedAt: "2026-08-21T01:02:03Z" });

  assert.equal(summary.input_url, "https://retailer.example/catalog");
  assert.equal(summary.catalog_url, "https://retailer.example/gpus");
  assert.doesNotMatch(JSON.stringify(summary), /fake-input-key|fake-catalog-token/);
});

test("CLI accepts a JSON file and writes only the sanitized summary", () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "raster-evidence-"));
  const inputPath = path.join(directory, "heal.json");
  const outputPath = path.join(directory, "public", "heal-summary.json");
  try {
    writeFileSync(inputPath, JSON.stringify({
      collectorId: "c_cli123",
      status: "healed",
      authorization: "Bearer fake-cli-token",
      rows: [{ title: "GPU", productUrl: "https://retailer.example/gpu?token=fake" }],
    }));
    const result = spawnSync(process.execPath, [sanitizerPath, "--kind", "heal", "--input", inputPath, "--output", outputPath], {
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr);
    const summary = JSON.parse(readFileSync(outputPath, "utf8"));
    assert.deepEqual(summary.collector_ids, ["c_cli123"]);
    assert.equal(summary.sample_rows[0].product_url, "https://retailer.example/gpu");
    assert.doesNotMatch(JSON.stringify(summary), /fake-cli-token|token=fake/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
