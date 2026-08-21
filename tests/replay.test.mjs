import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "../db/schema.ts";
import { createReplayGuard, createSourceRateGuard } from "../lib/d1/replay.ts";

async function realReplayDatabase() {
  const sqlite = new DatabaseSync(":memory:");
  for (const migration of ["0000_cuddly_kylun.sql", "0001_mute_ted_forrester.sql", "0002_eager_prodigy.sql", "0003_light_mandrill.sql"]) {
    sqlite.exec(await readFile(new URL(`../drizzle/${migration}`, import.meta.url), "utf8"));
  }
  const d1 = {
    prepare(sql) {
      return { bind(...params) {
        const statement = sqlite.prepare(sql);
        return {
          async first(column) { const row = statement.get(...params); return column && row ? row[column] : row; },
          async all() { return { results: statement.all(...params), success: true, meta: {} }; },
          async run() { statement.run(...params); return { success: true, meta: {} }; },
          async raw() { return statement.all(...params).map((row) => Object.values(row)); },
        };
      } };
    },
    async batch(statements) { return Promise.all(statements.map((statement) => statement.run())); },
    async exec(sql) { sqlite.exec(sql); return { count: 0, duration: 0 }; },
  };
  return { sqlite, db: drizzle(d1, { schema }) };
}

function replayDatabase({ inserted = true, existingExpiresAt } = {}) {
  const calls = { deletes: 0, insertedValues: undefined, completedValues: undefined, wheres: [] };
  return {
    calls,
    db: {
      delete() {
        return { where(condition) { calls.wheres.push(condition); return { async run() { calls.deletes += 1; } }; } };
      },
      insert() {
        return {
          values(values) {
            calls.insertedValues = values;
            return {
              onConflictDoNothing() {
                return {
                  returning() {
                    return { async get() { return inserted ? { key: values.key } : undefined; } };
                  },
                };
              },
            };
          },
        };
      },
      update() {
        return {
          set(values) {
            calls.completedValues = values;
            return { where(condition) { calls.wheres.push(condition); return { async run() {} }; } };
          },
        };
      },
      select() {
        return { from() { return { where() { return { async get() {
          return existingExpiresAt ? { expiresAt: existingExpiresAt } : undefined;
        } }; } }; } };
      },
    },
  };
}

function parameterValues(node, values = []) {
  if (!node || typeof node !== "object") return values;
  if (node.constructor?.name === "Param") values.push(node.value);
  for (const child of node.queryChunks ?? []) parameterValues(child, values);
  return values;
}

test("replay guard starts with a processing lease and promotes successful work", async () => {
  const fixture = replayDatabase();
  const now = new Date("2026-08-21T12:00:00.000Z");
  const claim = await createReplayGuard(fixture.db, () => now)("refresh", "1787313600", "{}");
  assert.equal(claim.acquired, true);
  assert.equal(fixture.calls.insertedValues.expiresAt, "2026-08-21T12:07:15.000Z");
  await claim.complete();
  assert.equal(fixture.calls.completedValues.expiresAt, "2026-08-21T12:10:00.000Z");
  assert.ok(parameterValues(fixture.calls.wheres.at(-1)).includes(now.toISOString()), "completion is fenced by its owner token");
});

test("replay guard releases an acquired processing lease", async () => {
  const fixture = replayDatabase();
  const claim = await createReplayGuard(fixture.db, () => new Date("2026-08-21T12:00:00.000Z"))("refresh", "1787313600", "{}");
  await claim.release();
  assert.equal(fixture.calls.deletes, 2, "one expiry purge plus one claim release");
  assert.ok(parameterValues(fixture.calls.wheres.at(-1)).includes("2026-08-21T12:00:00.000Z"), "release is fenced by its owner token");
});

test("source rate guard leases one provider run then holds a completion cooldown", async () => {
  const fixture = replayDatabase();
  let now = new Date("2026-08-21T12:00:00.000Z");
  const claim = await createSourceRateGuard(fixture.db, () => now)("central-computer");
  assert.equal(claim.acquired, true);
  assert.equal(claim.retryAfterSeconds, 0);
  assert.equal(fixture.calls.insertedValues.route, "refresh-rate");
  assert.equal(fixture.calls.insertedValues.expiresAt, "2026-08-21T12:07:15.000Z");
  now = new Date("2026-08-21T12:03:00.000Z");
  await claim.complete();
  assert.equal(fixture.calls.completedValues.expiresAt, "2026-08-21T12:04:00.000Z");
  assert.ok(parameterValues(fixture.calls.wheres.at(-1)).includes("2026-08-21T12:00:00.000Z"), "cooldown completion is owner fenced");
});

test("source rate guard denies a conflicting persistent lease with bounded retry timing", async () => {
  const fixture = replayDatabase({ inserted: false, existingExpiresAt: "2026-08-21T12:02:00.000Z" });
  const claim = await createSourceRateGuard(
    fixture.db,
    () => new Date("2026-08-21T12:00:00.000Z"),
  )("central-computer");
  assert.equal(claim.acquired, false);
  assert.equal(claim.retryAfterSeconds, 120);
  assert.equal(fixture.calls.deletes, 1, "expired receipts are purged before the atomic insert");
  await claim.complete();
  assert.equal(fixture.calls.completedValues, undefined, "a non-owner cannot alter the existing lease");
});

test("SQLite uniqueness serializes concurrent source claims and permits work after exact expiry", async () => {
  const { sqlite, db } = await realReplayDatabase();
  let current = new Date("2026-08-21T12:00:00.000Z");
  const guard = createSourceRateGuard(db, () => current, 60_000);
  const claims = await Promise.all([guard("central-computer"), guard("central-computer")]);
  assert.equal(claims.filter((claim) => claim.acquired).length, 1);
  assert.equal(claims.filter((claim) => !claim.acquired).length, 1);
  assert.ok(claims.find((claim) => !claim.acquired).retryAfterSeconds > 0);

  await claims.find((claim) => claim.acquired).complete();
  const cooldown = sqlite.prepare("SELECT expires_at FROM request_receipts WHERE route='refresh-rate'").get();
  assert.equal(cooldown.expires_at, "2026-08-21T12:01:00.000Z");
  current = new Date("2026-08-21T12:01:00.001Z");
  const afterExpiry = await guard("central-computer");
  assert.equal(afterExpiry.acquired, true);
  assert.equal(sqlite.prepare("SELECT count(*) AS count FROM request_receipts WHERE route='refresh-rate'").get().count, 1);
});
