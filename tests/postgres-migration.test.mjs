import assert from "node:assert/strict";
import test from "node:test";
import { createPostgresTestDatabase } from "./postgres-test-db.mjs";

let fixture;

test.before(async () => {
  fixture = await createPostgresTestDatabase();
});

test.after(async () => {
  await fixture?.close();
});

async function insertSource(sourceSlug = "pack-source") {
  await fixture.sql`
    INSERT INTO sources
      (slug, display_name, market, region, currency, base_url, collector_ids, onboarding_status, enabled)
    VALUES
      (${sourceSlug}, 'Pack Source', 'JP', 'JP', 'JPY', 'https://example.jp', '{"combined":"c_pack_source"}', 'ready', true)
  `;
}

async function insertPack({ slug = "japan", countryCode = "JP", currency = "JPY", sourceSlug = "pack-source", status = "pending" } = {}) {
  await fixture.sql`
    INSERT INTO market_packs
      (slug, country_code, label, currency, locale, symbol, source_slug, source_display_name,
       base_url, catalog_url, allowed_hosts, collector_id, status)
    VALUES
      (${slug}, ${countryCode}, 'Japan', ${currency}, 'ja-JP', '¥', ${sourceSlug}, 'Pack Source',
       'https://example.jp/', 'https://example.jp/gpus', '["example.jp"]', 'c_pack_source', ${status})
  `;
}

test("PostgreSQL migration installs the complete schema and migration journal", async () => {
  const tables = await fixture.sql`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name IN
      ('sources', 'products', 'offers', 'price_observations', 'collector_runs',
       'quarantined_rows', 'request_receipts', 'healing_events', 'market_packs')
    ORDER BY table_name
  `;
  assert.deepEqual(tables.map((row) => row.table_name), [
    "collector_runs", "healing_events", "market_packs", "offers", "price_observations",
    "products", "quarantined_rows", "request_receipts", "sources",
  ]);
  const migrations = await fixture.sql`SELECT count(*)::int AS count FROM drizzle.__drizzle_migrations`;
  assert.equal(migrations[0].count, 3);
});

test("PostgreSQL integrity triggers enforce Country Pack identity and ready boundaries", async () => {
  await insertSource();
  await insertPack();

  await assert.rejects(
    fixture.sql`UPDATE market_packs SET source_slug = 'replacement-source' WHERE slug = 'japan'`,
    /source_slug is immutable/,
  );
  await assert.rejects(
    fixture.sql`UPDATE market_packs SET country_code = 'DE' WHERE slug = 'japan'`,
    /country and currency are immutable/,
  );
  await fixture.sql`UPDATE market_packs SET catalog_url = 'https://example.jp/new-gpus' WHERE slug = 'japan'`;
  await fixture.sql`UPDATE market_packs SET status = 'ready' WHERE slug = 'japan'`;
  await assert.rejects(
    fixture.sql`UPDATE market_packs SET collector_id = 'c_replacement' WHERE slug = 'japan'`,
    /ready market pack collector boundary is immutable/,
  );
});

test("PostgreSQL healing evidence is append-only and keeps relational constraints", async () => {
  await insertSource("healing-source");
  await fixture.sql`
    INSERT INTO healing_events
      (session_id, source_slug, collector_id, stage, occurred_at, evidence_ref, detail, accepted_count)
    VALUES ('heal-postgres', 'healing-source', 'c_pack_source', 'healthy',
      '2026-08-21T08:00:00.000Z', 'evidence/heal/healthy.json', 'Baseline', 1)
  `;
  await assert.rejects(
    fixture.sql`UPDATE healing_events SET detail = 'tampered' WHERE session_id = 'heal-postgres'`,
    /append-only/,
  );
  await assert.rejects(
    fixture.sql`DELETE FROM healing_events WHERE session_id = 'heal-postgres'`,
    /append-only/,
  );
  await assert.rejects(
    fixture.sql`
      INSERT INTO healing_events
        (session_id, source_slug, collector_id, stage, occurred_at, evidence_ref, detail)
      VALUES ('heal-postgres', 'healing-source', 'c_pack_source', 'healthy',
        '2026-08-21T08:01:00.000Z', 'evidence/heal/duplicate.json', 'Duplicate')
    `,
    /duplicate key|unique constraint/i,
  );
  await assert.rejects(
    fixture.sql`
      INSERT INTO healing_events
        (session_id, source_slug, collector_id, stage, occurred_at, evidence_ref, detail)
      VALUES ('heal-invalid', 'missing-source', 'c_pack_source', 'broken',
        '2026-08-21T08:01:00.000Z', 'evidence/heal/missing.json', 'Missing source')
    `,
    /foreign key constraint/i,
  );
});

test("PostgreSQL transaction rollback leaves no partial Country Pack state", async () => {
  await assert.rejects(
    fixture.db.transaction(async (tx) => {
      await tx.insert((await import("../db/schema.ts")).sources).values({
        slug: "rollback-source",
        displayName: "Rollback Source",
        market: "DE",
        region: "DE",
        currency: "EUR",
        baseUrl: "https://example.de",
        collectorIds: '{"combined":"c_rollback"}',
        onboardingStatus: "pending",
        enabled: false,
      });
      throw new Error("forced transaction rollback");
    }),
    /forced transaction rollback/,
  );
  const rows = await fixture.sql`SELECT count(*)::int AS count FROM sources WHERE slug = 'rollback-source'`;
  assert.equal(rows[0].count, 0);
});
