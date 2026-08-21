import assert from "node:assert/strict";
import test from "node:test";
import { MarketPackValidationError, validateMarketPack } from "../lib/postgres/market-packs.ts";

const pending = {
  slug: "japan",
  countryCode: "JP",
  label: "Japan",
  currency: "JPY",
  locale: "ja-JP",
  symbol: "¥",
  sourceSlug: "example-japan",
  sourceDisplayName: "Example Japan",
  baseUrl: "https://example.jp",
  catalogUrl: "https://example.jp/gpus",
  allowedHosts: ["example.jp"],
  collectorId: "c_japan_gpu_01",
};

test("Country Pack admission is pending-only and ignores no evidence claims", () => {
  assert.equal(validateMarketPack(pending).status, "pending");
  for (const payload of [
    { ...pending, status: "ready" },
    { ...pending, eligibilityEvidenceRef: "evidence/japan/eligibility.md" },
    { ...pending, eligibilityVerifiedAt: "2026-08-20" },
    { ...pending, collectorCreatedEvidenceRef: "evidence/japan/create.md" },
    { ...pending, collectorRunEvidenceRef: "evidence/japan/run.md" },
  ]) {
    assert.throws(() => validateMarketPack(payload), MarketPackValidationError);
  }
});

test("evidence and promotion APIs exist as separate operations", async () => {
  const marketPacks = await import("../lib/postgres/market-packs.ts");
  assert.equal(typeof marketPacks.recordMarketPackEvidence, "function");
  assert.equal(typeof marketPacks.promoteMarketPack, "function");
});
