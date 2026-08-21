import assert from "node:assert/strict";
import test from "node:test";
import { handleStorageHealth } from "../app/api/storage-health/route.ts";

test("storage health reports only the safe PostgreSQL connectivity boundary", async () => {
  const response = await handleStorageHealth(() => ({ execute: async () => [{ healthy: 1 }] }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    status: "ok",
    storage: "hosted-postgresql",
    connection: "private-hyperdrive",
  });
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("storage health sanitizes database failures", async () => {
  const response = await handleStorageHealth(() => ({ execute: async () => { throw new Error("private connection detail"); } }));
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { status: "unavailable", storage: "hosted-postgresql" });
});
