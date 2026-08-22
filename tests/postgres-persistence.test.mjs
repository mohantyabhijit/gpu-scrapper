import assert from "node:assert/strict";
import test from "node:test";
import { ingestRows } from "../lib/ingest.ts";
import { persistIngestion, persistSourceFailure } from "../lib/postgres/repository.ts";
import { sourceRegistry } from "../config/sources.ts";
import { createPostgresTestDatabase } from "./postgres-test-db.mjs";

let fixture;

test.before(async () => {
  fixture = await createPostgresTestDatabase();
});

test.after(async () => {
  await fixture?.close();
});

const validRow = {
  source_slug: "central-computer",
  market: "US",
  title: "ASUS GeForce RTX 5080 16GB",
  product_url: "https://www.centralcomputer.com/asus-rtx-5080/sku-1",
  price: "1,099.99",
  currency: "USD",
  availability: "in stock",
  scraped_at: "2026-08-22T03:00:00.000Z",
  sku: "ASUS-5080-1",
  mpn: "TUF-RTX5080-O16G",
};

const invalidRow = {
  source_slug: "central-computer",
  market: "US",
  title: "malformed",
  product_url: "https://evil.example/hidden",
  currency: "USD",
  availability: "available",
  scraped_at: "2026-08-22T03:00:00.000Z",
};

const context = {
  sourceSlug: "central-computer",
  source: {
    ...sourceRegistry["central-computer"],
    enabled: true,
    collectorIds: { combined: "c_persist" },
    collectorRoles: ["combined"],
  },
  collectorId: "c_persist",
  responseId: "response-persist",
  startedAt: "2026-08-21T09:59:00.000Z",
  finishedAt: "2026-08-21T10:00:00.000Z",
  observedAt: "2026-08-21T10:00:00.000Z",
};

function batch(runId, rows = [validRow, invalidRow]) {
  return ingestRows(rows, { runId, observedAt: context.observedAt });
}

test("PostgreSQL persistence writes normalized state, quarantine, and run metadata", async () => {
  const result = await persistIngestion(fixture.db, batch("pg-run-1"), { ...context, runId: "pg-run-1" });
  assert.equal(result.status, "degraded");
  const counts = await fixture.sql`
    SELECT
      (SELECT count(*) FROM sources WHERE slug = 'central-computer')::int AS sources,
      (SELECT count(*) FROM products)::int AS products,
      (SELECT count(*) FROM offers)::int AS offers,
      (SELECT count(*) FROM price_observations)::int AS observations,
      (SELECT count(*) FROM quarantined_rows WHERE run_id = 'pg-run-1')::int AS quarantined,
      (SELECT count(*) FROM collector_runs WHERE run_id = 'pg-run-1')::int AS runs,
      (SELECT collector_id FROM collector_runs WHERE run_id = 'pg-run-1') AS collector_id,
      (SELECT response_id FROM collector_runs WHERE run_id = 'pg-run-1') AS response_id
  `;
  assert.deepEqual(counts[0], { sources: 1, products: 1, offers: 1, observations: 1, quarantined: 1, runs: 1, collector_id: "c_persist", response_id: "response-persist" });
});

test("PostgreSQL persistence is idempotent and preserves last-known-good offers", async () => {
  await persistIngestion(fixture.db, batch("pg-run-2"), { ...context, runId: "pg-run-2" });
  await persistIngestion(fixture.db, batch("pg-run-2"), { ...context, runId: "pg-run-2" });
  const duplicateCounts = await fixture.sql`
    SELECT
      (SELECT count(*) FROM offers WHERE source_slug = 'central-computer')::int AS offers,
      (SELECT count(*) FROM price_observations WHERE run_id = 'pg-run-2')::int AS observations,
      (SELECT count(*) FROM quarantined_rows WHERE run_id = 'pg-run-2')::int AS quarantined
  `;
  assert.deepEqual(duplicateCounts[0], { offers: 1, observations: 1, quarantined: 1 });

  await persistIngestion(fixture.db, batch("pg-run-3", [invalidRow]), { ...context, runId: "pg-run-3" });
  const degraded = await fixture.sql`SELECT price_minor, health FROM offers WHERE source_slug = 'central-computer'`;
  assert.equal(degraded[0].price_minor, 109999);
  assert.equal(degraded[0].health, "degraded");

  await persistIngestion(fixture.db, batch("pg-run-4", [validRow]), { ...context, runId: "pg-run-4" });
  const recovered = await fixture.sql`SELECT health FROM offers WHERE source_slug = 'central-computer'`;
  assert.equal(recovered[0].health, "healthy");
});

test("PostgreSQL persistence rolls back every statement after a mid-transaction failure", async () => {
  const before = await fixture.sql`
    SELECT
      (SELECT count(*) FROM sources)::int AS sources,
      (SELECT count(*) FROM products)::int AS products,
      (SELECT count(*) FROM offers)::int AS offers,
      (SELECT count(*) FROM collector_runs)::int AS runs
  `;
  await fixture.sql`
    CREATE OR REPLACE FUNCTION raster_test_fail_offer_insert()
    RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN RAISE EXCEPTION 'forced offer insert failure'; END;
    $$
  `;
  await fixture.sql`
    CREATE TRIGGER raster_test_fail_offer_insert
    BEFORE INSERT ON offers FOR EACH ROW EXECUTE FUNCTION raster_test_fail_offer_insert()
  `;
  try {
    await assert.rejects(
      persistIngestion(fixture.db, batch("pg-run-rollback", [validRow]), { ...context, runId: "pg-run-rollback" }),
      (error) => error?.cause?.message === "forced offer insert failure",
    );
  } finally {
    await fixture.sql`DROP TRIGGER raster_test_fail_offer_insert ON offers`;
    await fixture.sql`DROP FUNCTION raster_test_fail_offer_insert()`;
  }
  const rows = await fixture.sql`
    SELECT
      (SELECT count(*) FROM sources)::int AS sources,
      (SELECT count(*) FROM products)::int AS products,
      (SELECT count(*) FROM offers)::int AS offers,
      (SELECT count(*) FROM collector_runs)::int AS runs
  `;
  assert.deepEqual(rows[0], before[0]);
});

test("provider failure persistence preserves last-known-good fields and is idempotent", async () => {
  await persistIngestion(fixture.db, batch("pg-failure-seed", [validRow]), { ...context, runId: "pg-failure-seed" });
  const before = await fixture.sql`
    SELECT price_minor, availability, product_url, observed_at, updated_at
    FROM offers WHERE source_slug = 'central-computer'
  `;
  const failure = {
    source: {
      ...sourceRegistry["central-computer"],
      enabled: true,
      collectorIds: { combined: "c_failure" },
      collectorRoles: ["combined"],
    },
    sourceSlug: "central-computer",
    collectorId: "c_failure",
    responseId: "response-failure",
    code: "timeout",
    failedAt: "2026-08-21T12:00:00.000Z",
  };
  const first = await persistSourceFailure(fixture.db, failure);
  const second = await persistSourceFailure(fixture.db, failure);
  assert.equal(first.runId, second.runId);
  const later = await persistSourceFailure(fixture.db, { ...failure, failedAt: "2026-08-21T12:30:00.000Z" });
  assert.equal(first.runId, later.runId);
  const after = await fixture.sql`
    SELECT price_minor, availability, product_url, observed_at, updated_at, health
    FROM offers WHERE source_slug = 'central-computer'
  `;
  assert.deepEqual(after[0], { ...before[0], health: "degraded" });
  const runs = await fixture.sql`
    SELECT count(*)::int AS count, status, accepted_count, validation_summary, collector_id, response_id
    FROM collector_runs
    WHERE run_id = ${first.runId}
    GROUP BY status, accepted_count, validation_summary, collector_id, response_id
  `;
  assert.deepEqual(runs[0], {
    count: 1,
    status: "degraded",
    accepted_count: 0,
    validation_summary: JSON.stringify({ failureCode: "timeout" }),
    collector_id: "c_failure",
    response_id: "response-failure",
  });

  const preTrigger = { ...failure, responseId: undefined, code: "provider_error" };
  const preTriggerFirst = await persistSourceFailure(fixture.db, preTrigger);
  const preTriggerSecond = await persistSourceFailure(fixture.db, { ...preTrigger, failedAt: "2026-08-21T13:00:00.000Z" });
  assert.equal(preTriggerFirst.runId, preTriggerSecond.runId);

  await persistIngestion(fixture.db, batch("pg-failure-recovery", [validRow]), { ...context, runId: "pg-failure-recovery" });
  const recovered = await fixture.sql`SELECT health FROM offers WHERE source_slug = 'central-computer'`;
  assert.equal(recovered[0].health, "healthy");
});
