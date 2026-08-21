import test from "node:test";
import assert from "node:assert/strict";
import { createReplayGuard } from "../lib/d1/replay.ts";

function replayDatabase({ inserted = true } = {}) {
  const calls = { deletes: 0, insertedValues: undefined, completedValues: undefined };
  return {
    calls,
    db: {
      delete() {
        return { where() { return { async run() { calls.deletes += 1; } }; } };
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
            return { where() { return { async run() {} }; } };
          },
        };
      },
    },
  };
}

test("replay guard starts with a processing lease and promotes successful work", async () => {
  const fixture = replayDatabase();
  const now = new Date("2026-08-21T12:00:00.000Z");
  const claim = await createReplayGuard(fixture.db, () => now)("refresh", "1787313600", "{}");
  assert.equal(claim.acquired, true);
  assert.equal(fixture.calls.insertedValues.expiresAt, "2026-08-21T12:04:00.000Z");
  await claim.complete();
  assert.equal(fixture.calls.completedValues.expiresAt, "2026-08-21T12:10:00.000Z");
});

test("replay guard releases an acquired processing lease", async () => {
  const fixture = replayDatabase();
  const claim = await createReplayGuard(fixture.db, () => new Date("2026-08-21T12:00:00.000Z"))("refresh", "1787313600", "{}");
  await claim.release();
  assert.equal(fixture.calls.deletes, 2, "one expiry purge plus one claim release");
});
