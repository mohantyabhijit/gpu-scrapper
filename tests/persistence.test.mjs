import test from "node:test";
import assert from "node:assert/strict";
import { ingestRows } from "../lib/ingest.ts";
import { persistIngestion } from "../lib/postgres/repository.ts";
import * as schema from "../db/schema.ts";

class FakeInsert {
  constructor(db, table) {
    this.db = db;
    this.table = table;
    this.valuesToWrite = undefined;
    this.conflict = "update";
  }
  values(values) {
    this.valuesToWrite = values;
    return this;
  }
  onConflictDoUpdate() {
    this.conflict = "update";
    return this;
  }
  onConflictDoNothing() {
    this.conflict = "nothing";
    return this;
  }
  async execute() {
    this.db.write(this.table, this.valuesToWrite, this.conflict);
  }
  then(resolve, reject) {
    return this.execute().then(resolve, reject);
  }
  async run() {
    return this.execute();
  }
}

class FakeUpdate {
  constructor(db, table) {
    this.db = db;
    this.table = table;
    this.valuesToWrite = {};
    this.predicate = () => true;
  }
  set(values) {
    this.valuesToWrite = values;
    return this;
  }
  where(predicate) {
    this.predicate = predicate;
    return this;
  }
  async execute() {
    this.db.applyUpdate(this.table, this.valuesToWrite, this.predicate);
  }
  then(resolve, reject) {
    return this.execute().then(resolve, reject);
  }
  async run() {
    return this.execute();
  }
}

class FakeDb {
  constructor() {
    this.tables = new Map();
    this.batches = 0;
    this.transactions = 0;
    this.failTable = undefined;
  }
  insert(table) {
    return new FakeInsert(this, table);
  }
  update(table) {
    return new FakeUpdate(this, table);
  }
  async batch(queries) {
    if (!queries.length) throw new Error("transactions must contain at least one statement");
    const snapshot = structuredClone(this.tables);
    this.batches += 1;
    try {
      for (const query of queries) await query.execute();
    } catch (error) {
      this.tables = snapshot;
      throw error;
    }
  }
  async transaction(callback) {
    this.transactions += 1;
    const snapshot = structuredClone(this.tables);
    try {
      return await callback(this);
    } catch (error) {
      this.tables = snapshot;
      throw error;
    }
  }
  write(table, values, conflict) {
    const name = table === schema.sources
      ? "sources"
      : table === schema.products
        ? "products"
        : table === schema.offers
          ? "offers"
          : table === schema.priceObservations
            ? "observations"
            : table === schema.collectorRuns
              ? "runs"
              : "quarantine";
    if (this.failTable === name) throw new Error(`forced ${name} failure`);
    if (!this.tables.has(name)) this.tables.set(name, new Map());
    const map = this.tables.get(name);
    const key = name === "quarantine"
      ? `${values.runId}:${values.rowFingerprint}`
      : values.offerKey ?? values.observationKey ?? values.identityKey ?? values.slug ?? values.runId;
    if (map.has(key) && conflict === "nothing") return;
    map.set(key, { ...(map.get(key) ?? {}), ...values });
  }
  applyUpdate(table, values) {
    const name = table === schema.offers ? "offers" : "unknown";
    if (this.failTable === name) throw new Error(`forced ${name} failure`);
    const map = this.tables.get(name);
    if (!map) return;
    for (const [key, row] of map) {
      // All fixture offers belong to the source under test, so this deliberately
      // small fake applies the repository's source-scoped update to every row.
      map.set(key, { ...row, ...values });
    }
  }
  rows(name) {
    return [...(this.tables.get(name)?.values() ?? [])];
  }
}

const validRow = {
  source_slug: "central-computer",
  market: "US",
  title: "ASUS GeForce RTX 5080 16GB",
  product_url: "https://www.centralcomputer.com/asus-rtx-5080/sku-1",
  price: "1,099.99",
  currency: "USD",
  availability: "in stock",
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
};

function batch(runId, rows = [validRow, invalidRow]) {
  return ingestRows(rows, { runId, observedAt: "2026-08-21T10:00:00.000Z" });
}

const context = {
  runId: "run-1",
  sourceSlug: "central-computer",
  startedAt: "2026-08-21T09:59:00.000Z",
  finishedAt: "2026-08-21T10:00:00.000Z",
  observedAt: "2026-08-21T10:00:00.000Z",
};

test("persistence upserts valid state and quarantines invalid rows", async () => {
  const db = new FakeDb();
  const result = await persistIngestion(db, batch("run-1"), context);
  assert.equal(result.status, "degraded");
  assert.equal(db.transactions, 1);
  assert.equal(db.rows("sources").length, 1);
  assert.equal(db.rows("products").length, 1);
  assert.equal(db.rows("offers").length, 1);
  assert.equal(db.rows("observations").length, 1);
  assert.equal(db.rows("quarantine").length, 1);
  assert.equal(db.rows("offers")[0].health, "healthy");
  assert.equal(db.rows("runs")[0].status, "degraded");
});

test("replaying the same batch is idempotent and keeps last-known-good offers", async () => {
  const db = new FakeDb();
  await persistIngestion(db, batch("run-1"), context);
  await persistIngestion(db, batch("run-1"), context);
  assert.equal(db.rows("offers").length, 1);
  assert.equal(db.rows("observations").length, 1);
  assert.equal(db.rows("quarantine").length, 1);

  const failedRefresh = batch("run-2", [invalidRow]);
  await persistIngestion(db, failedRefresh, { ...context, runId: "run-2" });
  assert.equal(db.rows("offers").length, 1);
  assert.equal(db.rows("offers")[0].priceMinor, 109999);
  assert.equal(db.rows("offers")[0].health, "degraded");
  assert.equal(db.rows("runs").find((run) => run.runId === "run-2").status, "degraded");

  await persistIngestion(db, batch("run-3", [validRow]), { ...context, runId: "run-3" });
  assert.equal(db.rows("offers")[0].health, "healthy");
});

test("transaction rollback does not leave partial catalog state", async () => {
  const db = new FakeDb();
  db.failTable = "offers";
  await assert.rejects(persistIngestion(db, batch("run-rollback"), { ...context, runId: "run-rollback" }));
  assert.equal(db.rows("sources").length, 0);
  assert.equal(db.rows("products").length, 0);
  assert.equal(db.rows("offers").length, 0);
  assert.equal(db.rows("runs").length, 0);
});
