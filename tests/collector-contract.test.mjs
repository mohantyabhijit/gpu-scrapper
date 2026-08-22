import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { marketCurrency, validateCollectorOutput, validateRawOffer } from "../scrapers/contracts.ts";
import { sourceHostIsAllowed, sourceRegistry } from "../config/sources.ts";

const p0ManifestSlugs = ["dynacore", "infinity-computer", "tech-deals", "pc-themes"];

test("source registry is role keyed and only registers the proven Dynacore collector", () => {
  assert.equal(sourceRegistry["central-computer"].role, "primary");
  assert.equal(sourceRegistry["central-computer"].currency, "USD");
  assert.equal("tradezone" in sourceRegistry, false);
  assert.deepEqual(sourceRegistry.dynacore.collectorIds, { combined: "c_mt3qzv5p215cci1r2e" });
  assert.equal(sourceRegistry.dynacore.enabled, true);
  assert.equal(Object.values(sourceRegistry).filter((source) => Object.keys(source.collectorIds).length > 0).length, 1);
});

test("Dynacore uses the current public GPU collection and is enabled after live proof", () => {
  const source = sourceRegistry.dynacore;
  assert.equal(source.catalogUrl, "https://dynacoretech.com/collections/gpu");
  assert.equal(sourceHostIsAllowed("dynacore", source.catalogUrl), true);
  assert.equal(source.enabled, true);
  assert.deepEqual(source.collectorIds, { combined: "c_mt3qzv5p215cci1r2e" });
});

test("Dynacore catalog URL and live-proof state stay consistent across source artifacts", async () => {
  const expectedUrl = "https://dynacoretech.com/collections/gpu";
  const source = sourceRegistry.dynacore;
  const [manifestText, eligibilityText, evidenceText] = await Promise.all([
    readFile(new URL("../scrapers/manifests/dynacore.json", import.meta.url), "utf8"),
    readFile(new URL("../docs/source-eligibility.md", import.meta.url), "utf8"),
    readFile(new URL("../evidence/sources/dynacore-eligibility.md", import.meta.url), "utf8"),
  ]);
  const manifest = JSON.parse(manifestText);

  assert.equal(source.catalogUrl, expectedUrl);
  assert.equal(manifest.target_url, expectedUrl);
  assert.ok(eligibilityText.includes(`<${expectedUrl}>`));
  assert.ok(evidenceText.includes(`catalog_url: ${expectedUrl}`));
  assert.equal(source.enabled, true);
  assert.deepEqual(source.collectorIds, { combined: "c_mt3qzv5p215cci1r2e" });
  assert.match(eligibilityText, /Dynacore live proof/);
  assert.match(eligibilityText, /c_mt3qzv5p215cci1r2e/);
  assert.match(evidenceText, /combined: c_mt3qzv5p215cci1r2e/);
  assert.match(evidenceText, /repeat-read pass/);
});

test("Infinity Computer is source-bound and remains disabled after invalid live reads", async () => {
  const expectedUrl = "https://infinitycomputer.com.sg/prices";
  const source = sourceRegistry["infinity-computer"];
  const manifest = JSON.parse(await readFile(new URL("../scrapers/manifests/infinity-computer.json", import.meta.url), "utf8"));
  assert.equal(source.catalogUrl, expectedUrl);
  assert.equal(sourceHostIsAllowed("infinity-computer", expectedUrl), true);
  assert.equal(manifest.target_url, expectedUrl);
  assert.equal(manifest.source_slug, "infinity-computer");
  assert.equal(source.enabled, false);
  assert.deepEqual(source.collectorIds, {});
  assert.equal(manifest.evidence_state, "live-create-run-repeat-read-invalid-output");
});

test("Infinity invalid-output evidence keeps the exact ID, URL, and honest counts", async () => {
  const [eligibility, runOne, runTwo] = await Promise.all([
    readFile(new URL("../evidence/sources/infinity-computer-eligibility.md", import.meta.url), "utf8"),
    readFile(new URL("../evidence/collectors/infinity-computer-run-20260822-01.json", import.meta.url), "utf8"),
    readFile(new URL("../evidence/collectors/infinity-computer-run-20260822-02.json", import.meta.url), "utf8"),
  ]);
  for (const evidence of [eligibility, runOne, runTwo]) {
    assert.match(evidence, /c_mt3snqaln8ckpnqxt/);
    assert.match(evidence, /https:\/\/infinitycomputer\.com\.sg\/prices/);
  }
  for (const run of [JSON.parse(runOne), JSON.parse(runTwo)]) {
    assert.equal(run.counts.source_cards, 678);
    assert.equal(run.counts.gpu_cards, 59);
    assert.equal(run.counts.accepted_rows, 0);
    assert.equal(run.counts.price_required, 59);
    assert.equal(run.processing.adapter_result, "passed");
    assert.equal(run.processing.validator_result, "failed");
  }
});

test("Singapore P0 manifests are bounded, registry-owned, and ready for real CLI creation", async () => {
  for (const slug of p0ManifestSlugs) {
    const manifestUrl = new URL(`../scrapers/manifests/${slug}.json`, import.meta.url);
    const manifest = JSON.parse(await readFile(manifestUrl, "utf8"));
    const source = sourceRegistry[slug];
    assert.equal(manifest.schema_version, 1);
    assert.equal(manifest.source_slug, source.slug);
    assert.equal(manifest.role, "combined");
    assert.equal(manifest.target_url, source.catalogUrl);
    assert.equal(manifest.market, source.region);
    assert.equal(manifest.currency, source.currency);
    if (slug === "dynacore") {
      assert.equal(source.enabled, true);
      assert.deepEqual(source.collectorIds, { combined: "c_mt3qzv5p215cci1r2e" });
      assert.equal(manifest.evidence_state, "live-create-run-repeat-read");
    } else if (slug === "infinity-computer") {
      assert.equal(source.enabled, false);
      assert.deepEqual(source.collectorIds, {});
      assert.equal(manifest.evidence_state, "live-create-run-repeat-read-invalid-output");
    } else {
      assert.equal(source.enabled, false);
      assert.deepEqual(source.collectorIds, {});
      assert.equal(manifest.evidence_state, "pending-live-create-run");
    }
    assert.ok(manifest.description.length > 80 && manifest.description.length <= 500);
    assert.match(manifest.description, /public GPU product/i);
    assert.match(manifest.description, /personal data/i);
    assert.doesNotMatch(JSON.stringify(manifest), /api[_-]?key|authorization|bearer|password|secret/i);
  }
});

test("published JSON schema requires the complete explicit collector row", async () => {
  const schema = JSON.parse(await readFile(new URL("../scrapers/contracts/gpu-offer.schema.json", import.meta.url), "utf8"));
  assert.equal(schema.additionalProperties, false);
  for (const field of ["source_slug", "market", "title", "product_url", "price", "currency", "availability", "sku", "mpn", "manufacturer", "board_partner", "raw_model", "image_url", "scraped_at"]) {
    assert.ok(schema.required.includes(field), `${field} must be explicit in collector output`);
  }
});

test("contract accepts a public allowlisted offer", () => {
  const result = validateRawOffer({
    source_slug: "central-computer",
    market: "US",
    title: "ASUS GeForce RTX 5080 16GB GDDR7",
    product_url: "https://www.centralcomputer.com/asus-geforce-rtx-5080-16gb/best-deal/123",
    price: "24,999.00",
    currency: "USD",
    availability: "In Stock",
    scraped_at: "2026-08-22T03:00:00.000Z",
  });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.value.currency, "USD");
});

test("contract quarantines unknown hosts and missing prices", () => {
  const result = validateRawOffer({
    source_slug: "central-computer",
    market: "US",
    title: "RTX 5080",
    product_url: "https://evil.example/rtx-5080",
    currency: "USD",
    availability: "available",
    scraped_at: "2026-08-22T03:00:00.000Z",
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.deepEqual(result.errors, ["url_not_allowed", "price_required"]);
});

test("market currency mapping is fixed for the supported markets", () => {
  assert.equal(marketCurrency("US"), "USD");
  assert.equal(marketCurrency("UK"), "GBP");
  assert.equal(marketCurrency("IN"), "INR");
  assert.equal(marketCurrency("SG"), "SGD");
  assert.equal(marketCurrency("EUR"), undefined);
});

test("contract rejects a currency that does not belong to the declared market", () => {
  const result = validateRawOffer({
    source_slug: "central-computer",
    market: "US",
    title: "RTX 5080",
    product_url: "https://www.centralcomputer.com/graphics-card/5080",
    price: "2,499.00",
    currency: "GBP",
    availability: "available",
    scraped_at: "2026-08-22T03:00:00.000Z",
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.deepEqual(result.errors, ["currency_market_mismatch"]);
  }
});

function explicitRow(overrides = {}) {
  return {
    source_slug: "dynacore",
    market: "SG",
    title: "ASUS GeForce RTX 5080 16GB",
    product_url: "https://dynacoretech.com/products/rtx-5080",
    price: "2199.00",
    currency: "SGD",
    availability: "in_stock",
    sku: null,
    mpn: "RTX5080-001",
    manufacturer: "NVIDIA",
    board_partner: "ASUS",
    raw_model: "ROG-STRIX-RTX5080-O16G",
    image_url: null,
    scraped_at: "2026-08-21T10:00:00.000Z",
    ...overrides,
  };
}

test("collector validator accepts the complete explicit row and retains raw_model", () => {
  const result = validateCollectorOutput([explicitRow()], "dynacore");
  assert.equal(result.ok, true);
  assert.equal(result.acceptedCount, 1);
  const contract = validateRawOffer(explicitRow());
  assert.equal(contract.ok, true);
  if (contract.ok) assert.equal(contract.value.rawModel, "ROG-STRIX-RTX5080-O16G");
});

test("collector validator requires nullable fields to be present and rejects extra or PII-like fields", () => {
  const missing = explicitRow();
  delete missing.image_url;
  const missingResult = validateCollectorOutput([missing], "dynacore");
  assert.equal(missingResult.ok, false);
  assert.equal(missingResult.errorCounts.missing_field, 1);

  const extraResult = validateCollectorOutput([explicitRow({ seller_email: "hidden@example.invalid" })], "dynacore");
  assert.equal(extraResult.ok, false);
  assert.equal(extraResult.errorCounts.contact_field, 1);
});

test("collector validator rejects invalid timestamps, malformed members, and empty results", () => {
  const timestampResult = validateCollectorOutput([explicitRow({ scraped_at: "not-a-timestamp" })], "dynacore");
  assert.equal(timestampResult.errorCounts.timestamp_invalid, 1);
  const impossibleDate = validateCollectorOutput([explicitRow({ scraped_at: "2026-02-29T10:00:00Z" })], "dynacore");
  assert.equal(impossibleDate.errorCounts.timestamp_invalid, 1);
  const impossibleDay = validateCollectorOutput([explicitRow({ scraped_at: "2026-04-31T10:00:00Z" })], "dynacore");
  assert.equal(impossibleDay.errorCounts.timestamp_invalid, 1);
  const impossibleTime = validateCollectorOutput([explicitRow({ scraped_at: "2026-01-01T24:00:00+05:30" })], "dynacore");
  assert.equal(impossibleTime.errorCounts.timestamp_invalid, 1);
  assert.equal(validateCollectorOutput([explicitRow({ scraped_at: "2026-02-28T10:00:00+05:30" })], "dynacore").ok, true);
  const membersResult = validateCollectorOutput([explicitRow(), null, "row"], "dynacore");
  assert.equal(membersResult.ok, false);
  assert.equal(membersResult.errorCounts.not_an_object, 2);
  const emptyResult = validateCollectorOutput({ rows: [] }, "dynacore");
  assert.equal(emptyResult.errorCounts.empty_results, 1);
  const malformedWrapper = validateCollectorOutput({ rows: [], metadata: {} }, "dynacore");
  assert.equal(malformedWrapper.errorCounts.malformed_wrapper, 1);
});

test("raw offer validation requires a provider scraped_at and never fabricates one", () => {
  const missing = validateRawOffer(explicitRow({ scraped_at: undefined }));
  assert.equal(missing.ok, false);
  if (!missing.ok) assert.deepEqual(missing.errors, ["scraped_at_invalid"]);
  const invalid = validateRawOffer(explicitRow({ scraped_at: "not-a-timestamp" }));
  assert.equal(invalid.ok, false);
  if (!invalid.ok) assert.deepEqual(invalid.errors, ["scraped_at_invalid"]);
});

test("raw offer validation enforces the exact expected source identity", () => {
  const mismatch = validateRawOffer(explicitRow({
    source_slug: "tech-deals",
    product_url: "https://www.techdeals.com.sg/collections/graphics-card-1/rtx-5070",
  }), "dynacore");
  assert.equal(mismatch.ok, false);
  if (!mismatch.ok) assert.deepEqual(mismatch.errors, ["unknown_source"]);

  const missing = validateRawOffer(explicitRow({ source_slug: undefined }), "dynacore");
  assert.equal(missing.ok, false);
  if (!missing.ok) assert.deepEqual(missing.errors, ["unknown_source"]);
});

test("validator rejects inherited source names without throwing", () => {
  for (const sourceSlug of ["constructor", "toString"]) {
    assert.doesNotThrow(() => {
      const result = validateCollectorOutput([explicitRow({ source_slug: sourceSlug })]);
      assert.equal(result.ok, false);
      assert.equal(result.errorCounts.unknown_source, 1);
    });
  }
});

test("collector validator rejects off-domain URLs and unsupported currencies", () => {
  const offDomain = validateCollectorOutput([explicitRow({ product_url: "https://evil.example/gpu" })], "dynacore");
  assert.equal(offDomain.errorCounts.url_not_allowed, 1);
  const wrongCurrency = validateCollectorOutput([explicitRow({ currency: "USD" })], "dynacore");
  assert.equal(wrongCurrency.errorCounts.currency_market_mismatch, 1);
});

test("collector validator accepts recognized Bright Data wrappers but never fake IDs", () => {
  const wrapped = validateCollectorOutput({ data: [explicitRow()] }, "dynacore");
  assert.equal(wrapped.ok, true);
  for (const source of Object.values(sourceRegistry)) {
    if (source.slug === "dynacore") {
      assert.deepEqual(source.collectorIds, { combined: "c_mt3qzv5p215cci1r2e" });
      assert.equal(source.enabled, true);
    } else {
      assert.deepEqual(source.collectorIds, {});
      assert.equal(source.enabled, false);
    }
  }
});
