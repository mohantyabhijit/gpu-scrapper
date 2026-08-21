import assert from "node:assert/strict";
import test from "node:test";
import { createPostgresTestDatabase } from "./postgres-test-db.mjs";
import { createReplayGuard, createSourceRateGuard } from "../lib/d1/replay.ts";

let fixture;

test.before(async () => {
  fixture = await createPostgresTestDatabase();
});

test.after(async () => {
  await fixture?.close();
});

test("PostgreSQL serializes concurrent replay claims and fences the owner", async () => {
  const now = new Date("2026-08-21T12:00:00.000Z");
  const guard = createReplayGuard(fixture.db, () => now);
  const claims = await Promise.all([
    guard("refresh", "1787313600", '{"sourceSlugs":["central-computer"]}'),
    guard("refresh", "1787313600", '{"sourceSlugs":["central-computer"]}'),
  ]);
  assert.equal(claims.filter((claim) => claim.acquired).length, 1);
  assert.equal(claims.filter((claim) => !claim.acquired).length, 1);

  const winner = claims.find((claim) => claim.acquired);
  const loser = claims.find((claim) => !claim.acquired);
  await loser.complete();
  let receipt = await fixture.sql`SELECT expires_at FROM request_receipts WHERE route = 'refresh'`;
  assert.equal(receipt.length, 1);
  const leaseExpiry = receipt[0].expires_at;
  await winner.complete();
  receipt = await fixture.sql`SELECT expires_at FROM request_receipts WHERE route = 'refresh'`;
  assert.equal(receipt[0].expires_at, "2026-08-21T12:10:00.000Z");
  assert.notEqual(receipt[0].expires_at, leaseExpiry);

  await loser.release();
  receipt = await fixture.sql`SELECT count(*)::int AS count FROM request_receipts WHERE route = 'refresh'`;
  assert.equal(receipt[0].count, 1, "a non-owner cannot delete the completed receipt");
});

test("PostgreSQL serializes source-rate claims and preserves cooldown after completion", async () => {
  let now = new Date("2026-08-21T12:00:00.000Z");
  const guard = createSourceRateGuard(fixture.db, () => now, 60_000);
  const claims = await Promise.all([
    guard("central-computer"),
    guard("central-computer"),
  ]);
  assert.equal(claims.filter((claim) => claim.acquired).length, 1);
  assert.equal(claims.filter((claim) => !claim.acquired).length, 1);
  const loser = claims.find((claim) => !claim.acquired);
  assert.ok(loser.retryAfterSeconds > 0);

  await claims.find((claim) => claim.acquired).complete();
  const cooldown = await fixture.sql`SELECT expires_at FROM request_receipts WHERE route = 'refresh-rate'`;
  assert.equal(cooldown[0].expires_at, "2026-08-21T12:01:00.000Z");

  now = new Date("2026-08-21T12:01:00.001Z");
  const afterExpiry = await guard("central-computer");
  assert.equal(afterExpiry.acquired, true);
  const remaining = await fixture.sql`SELECT count(*)::int AS count FROM request_receipts WHERE route = 'refresh-rate'`;
  assert.equal(remaining[0].count, 1);
});

test("PostgreSQL replay cleanup removes expired leases before a new claim", async () => {
  await fixture.sql`
    INSERT INTO request_receipts (key, route, created_at, expires_at)
    VALUES ('expired-receipt', 'refresh', '2026-08-21T11:00:00.000Z', '2026-08-21T11:59:59.000Z')
  `;
  const claim = await createReplayGuard(
    fixture.db,
    () => new Date("2026-08-21T12:00:00.000Z"),
  )("refresh", "expired-timestamp", "{}");
  assert.equal(claim.acquired, true);
  const expired = await fixture.sql`SELECT count(*)::int AS count FROM request_receipts WHERE key = 'expired-receipt'`;
  assert.equal(expired[0].count, 0);
  await claim.release();
});
