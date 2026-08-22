import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { sourceRegistry } from "../config/sources.ts";
import { parseCollectArgs, resolveCollectionTarget } from "../scripts/collect.ts";
import { parseValidatorArgs, validateCollectorFile } from "../scripts/validate-collector-output.ts";

test("collection CLI accepts only a registered source and role", () => {
  assert.deepEqual(parseCollectArgs(["--source", "dynacore"]), { source: "dynacore", role: "combined" });
  assert.throws(() => parseCollectArgs(["--source", "dynacore", "--url", "https://evil.example"]));
  assert.throws(() => parseCollectArgs(["--source", "dynacore", "--collector-id", "c_fake"]));
  assert.throws(() => parseCollectArgs(["--source", "constructor"]));
  assert.throws(() => parseCollectArgs(["--source", "toString"]));
});

test("collection target resolution refuses disabled or malformed IDs and binds the registry URL", () => {
  const source = sourceRegistry.dynacore;
  const original = { enabled: source.enabled, collectorIds: source.collectorIds };
  source.enabled = false;
  source.collectorIds = {};
  assert.equal(resolveCollectionTarget("dynacore", "combined"), undefined);
  source.enabled = true;
  source.collectorIds = { combined: "not-a-collector-id" };
  assert.equal(resolveCollectionTarget("dynacore", "combined"), undefined);
  source.collectorIds = { combined: "c_raster_u2_test" };
  assert.deepEqual(resolveCollectionTarget("dynacore", "combined"), {
    source,
    collectorId: "c_raster_u2_test",
    inputUrl: source.catalogUrl,
  });
  source.enabled = original.enabled;
  source.collectorIds = original.collectorIds;
});

test("validator CLI accepts a local path and optional registered source only", () => {
  assert.deepEqual(parseValidatorArgs(["--input", "/tmp/provider.json", "--source", "pc-themes"]), {
    input: "/tmp/provider.json",
    source: "pc-themes",
  });
  assert.throws(() => parseValidatorArgs(["--input", "/tmp/provider.json", "--source", "tradezone"]));
  assert.throws(() => parseValidatorArgs(["--input", "/tmp/provider.json", "--source", "constructor"]));
  assert.throws(() => parseValidatorArgs(["--input", "/tmp/provider.json", "--source", "toString"]));
});

test("documented validator applies Dynacore adaptation before shared validation", async () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "raster-dynacore-validator-"));
  const inputPath = path.join(directory, "provider-run.json");
  try {
    writeFileSync(inputPath, JSON.stringify([{
      source_slug: "dynacore",
      market: "SG",
      title: "GIGABYTE RTX 5070 12GB",
      product_url: "https://dynacoretech.com/products/rtx-5070",
      price: { value: 1569, currency: "SGD" },
      currency: "SGD",
      scraped_at: "2026-08-22T03:00:00.000Z",
      product_page_url: "https://dynacoretech.com/products/rtx-5070",
      input: { url: "https://dynacoretech.com/collections/gpu" },
    }]));
    const summary = await validateCollectorFile(inputPath, "dynacore");
    assert.equal(summary.ok, true);
    assert.equal(summary.adapter_result, "passed");
    assert.equal(summary.adapter_rejected_count, 0);
    assert.equal(summary.acceptedCount, 1);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("documented validator quarantines Infinity call-for-price rows before shared validation", async () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "raster-infinity-validator-"));
  const inputPath = path.join(directory, "provider-run.json");
  try {
    writeFileSync(inputPath, JSON.stringify([{
      category: "GPU",
      market: "SG",
      title: "ASUS DUAL RTX 5060",
      canonical_product_url: "https://infinitycomputer.com.sg/product/rtx-5060",
      price_sgd: { value: null, currency: "SGD" },
      availability: "In Stock",
      sku: "SKU-5060",
      mpn: "MPN-5060",
      scraped_at: "2026-08-22T03:00:00.000Z",
    }]));
    const summary = await validateCollectorFile(inputPath, "infinity-computer");
    assert.equal(summary.ok, false);
    assert.equal(summary.adapter_result, "failed");
    assert.equal(summary.adapter_rejected_count, 1);
    assert.equal(summary.acceptedCount, 0);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
