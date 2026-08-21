import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";

async function sql(name) {
  return readFile(new URL(`../drizzle/${name}`, import.meta.url), "utf8");
}

test("0002 upgrades populated legacy data without breaking foreign keys", async () => {
  const db = new DatabaseSync(":memory:");
  db.exec(await sql("0000_cuddly_kylun.sql"));
  db.exec(await sql("0001_mute_ted_forrester.sql"));
  db.exec("INSERT INTO sources(slug,display_name,market,region,currency,base_url,enabled) VALUES('seed','Seed','US','US','USD','https://seed.example',1)");
  db.exec("INSERT INTO products(identity_key,slug,gpu_family,model,search_text,updated_at) VALUES('p','p','gpu','GPU','gpu','2026-08-21')");
  db.exec("INSERT INTO offers(offer_key,product_identity_key,source_slug,market,title,product_url,price_minor,currency,availability,observed_at,updated_at) VALUES('o','p','seed','US','GPU','https://seed.example/gpu',100,'USD','in_stock','2026-08-21','2026-08-21')");

  db.exec(await sql("0002_eager_prodigy.sql"));

  assert.deepEqual({ ...db.prepare("SELECT slug, enabled, onboarding_status FROM sources").get() }, { slug: "seed", enabled: 1, onboarding_status: "pending" });
  assert.equal(db.prepare("SELECT count(*) AS count FROM offers").get().count, 1);
  assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
});

test("0002 makes a Country Pack source binding immutable", async () => {
  const db = new DatabaseSync(":memory:");
  db.exec(await sql("0000_cuddly_kylun.sql"));
  db.exec(await sql("0001_mute_ted_forrester.sql"));
  db.exec(await sql("0002_eager_prodigy.sql"));
  db.exec("INSERT INTO market_packs(slug,country_code,label,currency,locale,symbol,source_slug,source_display_name,base_url,catalog_url,allowed_hosts,collector_id) VALUES('japan','JP','Japan','JPY','ja-JP','¥','example-japan','Example Japan','https://example.jp/','https://example.jp/gpus','[\"example.jp\"]','c_japan_gpu_01')");
  assert.throws(() => db.exec("UPDATE market_packs SET source_slug='replacement' WHERE slug='japan'"), /immutable/);
  assert.equal(db.prepare("SELECT source_slug FROM market_packs WHERE slug='japan'").get().source_slug, "example-japan");
});

test("0003 and 0004 add replay receipts and constrained append-only healing evidence", async () => {
  const db = new DatabaseSync(":memory:");
  db.exec(await sql("0000_cuddly_kylun.sql"));
  db.exec(await sql("0001_mute_ted_forrester.sql"));
  db.exec(await sql("0002_eager_prodigy.sql"));
  db.exec(await sql("0003_light_mandrill.sql"));
  db.exec(await sql("0004_giant_madame_masque.sql"));
  db.exec("INSERT INTO sources(slug,display_name,market,region,currency,base_url,collector_ids,onboarding_status,enabled) VALUES('example-japan','Example Japan','JP','JP','JPY','https://example.jp','{\"combined\":\"c_japan_gpu_01\"}','ready',1)");
  db.exec("INSERT INTO healing_events(session_id,source_slug,collector_id,stage,occurred_at,evidence_ref,detail,accepted_count) VALUES('heal-japan-20260821','example-japan','c_japan_gpu_01','healthy','2026-08-21T08:00:00.000Z','evidence/heal/01.json','Baseline passed',2)");

  assert.equal(db.prepare("SELECT count(*) AS count FROM request_receipts").get().count, 0);
  assert.equal(db.prepare("SELECT stage FROM healing_events").get().stage, "healthy");
  assert.throws(() => db.exec("INSERT INTO healing_events(session_id,source_slug,collector_id,stage,occurred_at,evidence_ref,detail) VALUES('heal-japan-20260821','example-japan','c_japan_gpu_01','healthy','2026-08-21T08:01:00.000Z','evidence/heal/duplicate.json','Duplicate')"), /UNIQUE/);
  assert.throws(() => db.exec("INSERT INTO healing_events(session_id,source_slug,collector_id,stage,occurred_at,evidence_ref,detail) VALUES('heal-invalid','example-japan','c_japan_gpu_01','invented','2026-08-21T08:01:00.000Z','evidence/heal/invalid.json','Invalid')"), /CHECK/);
  assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
});

test("0005 freezes Country Pack identity and every ready collector boundary", async () => {
  const db = new DatabaseSync(":memory:");
  for (const migration of [
    "0000_cuddly_kylun.sql",
    "0001_mute_ted_forrester.sql",
    "0002_eager_prodigy.sql",
    "0003_light_mandrill.sql",
    "0004_giant_madame_masque.sql",
    "0005_freeze_ready_country_pack.sql",
  ]) db.exec(await sql(migration));
  db.exec("INSERT INTO market_packs(slug,country_code,label,currency,locale,symbol,source_slug,source_display_name,base_url,catalog_url,allowed_hosts,collector_id,status) VALUES('japan','JP','Japan','JPY','ja-JP','¥','example-japan','Example Japan','https://example.jp/','https://example.jp/gpus','[\"example.jp\"]','c_japan_gpu_01','ready')");

  for (const statement of [
    "UPDATE market_packs SET country_code='KR' WHERE slug='japan'",
    "UPDATE market_packs SET currency='KRW' WHERE slug='japan'",
    "UPDATE market_packs SET source_slug='replacement-japan' WHERE slug='japan'",
    "UPDATE market_packs SET source_display_name='Replacement Japan' WHERE slug='japan'",
    "UPDATE market_packs SET base_url='https://replacement.example/' WHERE slug='japan'",
    "UPDATE market_packs SET catalog_url='https://example.jp/new-gpus' WHERE slug='japan'",
    "UPDATE market_packs SET allowed_hosts='[\"example.jp\",\"cdn.example.jp\"]' WHERE slug='japan'",
    "UPDATE market_packs SET collector_id='c_replacement_gpu_02' WHERE slug='japan'",
  ]) assert.throws(() => db.exec(statement), /immutable/);

  db.exec("INSERT INTO market_packs(slug,country_code,label,currency,locale,symbol,source_slug,source_display_name,base_url,catalog_url,allowed_hosts,collector_id,status) VALUES('korea','KR','Korea','KRW','ko-KR','₩','example-korea','Example Korea','https://example.kr/','https://example.kr/gpus','[\"example.kr\"]','c_korea_gpu_01','pending')");
  assert.throws(() => db.exec("INSERT INTO market_packs(slug,country_code,label,currency,locale,symbol,source_slug,source_display_name,base_url,catalog_url,allowed_hosts,collector_id) VALUES('duplicate-country','KR','Duplicate','KRW','ko-KR','₩','duplicate-country-source','Duplicate','https://duplicate.example/','https://duplicate.example/gpus','[\"duplicate.example\"]','c_duplicate_01')"), /UNIQUE/);
  assert.throws(() => db.exec("INSERT INTO market_packs(slug,country_code,label,currency,locale,symbol,source_slug,source_display_name,base_url,catalog_url,allowed_hosts,collector_id) VALUES('duplicate-source','NZ','Duplicate','NZD','en-NZ','$','example-korea','Duplicate','https://duplicate.example/','https://duplicate.example/gpus','[\"duplicate.example\"]','c_duplicate_02')"), /UNIQUE/);
  db.exec("UPDATE market_packs SET collector_id='c_korea_gpu_02', catalog_url='https://example.kr/new-gpus' WHERE slug='korea'");
  assert.deepEqual(
    { ...db.prepare("SELECT collector_id, catalog_url FROM market_packs WHERE slug='korea'").get() },
    { collector_id: "c_korea_gpu_02", catalog_url: "https://example.kr/new-gpus" },
  );
});
