import test from "node:test";
import assert from "node:assert/strict";
import { createReplayGuard } from "../lib/d1/replay.ts";

function replayDatabase({ inserted = true } = {}) {
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
