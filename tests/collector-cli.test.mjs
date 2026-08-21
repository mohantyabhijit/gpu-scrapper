import assert from "node:assert/strict";
import test from "node:test";
import { sourceRegistry } from "../config/sources.ts";
import { parseCollectArgs, resolveCollectionTarget } from "../scripts/collect.ts";
import { parseValidatorArgs } from "../scripts/validate-collector-output.ts";

test("collection CLI accepts only a registered source and role", () => {
  assert.deepEqual(parseCollectArgs(["--source", "dynacore"]), { source: "dynacore", role: "combined" });
  assert.throws(() => parseCollectArgs(["--source", "dynacore", "--url", "https://evil.example"]));
  assert.throws(() => parseCollectArgs(["--source", "dynacore", "--collector-id", "c_fake"]));
});

test("collection target resolution refuses disabled or malformed IDs and binds the registry URL", () => {
  const source = sourceRegistry.dynacore;
  const original = { enabled: source.enabled, collectorIds: source.collectorIds };
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
});
