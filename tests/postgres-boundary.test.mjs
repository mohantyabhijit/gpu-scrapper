import assert from "node:assert/strict";
import { access, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";
import * as schema from "../db/schema.ts";
import { createSqliteTestDatabase } from "./sqlite-test-db.mjs";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const productionPath = ["lib", "d1"].join("/");

async function filesUnder(relativePath) {
  const absolutePath = path.join(root, relativePath);
  const entries = [];
  async function visit(current) {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const child = path.join(current, entry.name);
      if (entry.isDirectory()) await visit(child);
      else entries.push(child);
    }
  }
  await visit(absolutePath);
  return entries;
}

test("production imports and migration configuration are PostgreSQL-only", async () => {
  await assert.rejects(access(path.join(root, productionPath)));
  const sourceFiles = (await Promise.all(["app", "lib", "tests", "scripts"].map(filesUnder))).flat();
  const source = await Promise.all(sourceFiles.map((file) => readFile(file, "utf8")));
  assert.equal(source.some((text) => text.includes(productionPath)), false);

  const config = await readFile(path.join(root, "drizzle.config.ts"), "utf8");
  assert.match(config, /schema:\s*["']\.\/db\/schema\.ts["']/);
  assert.match(config, /out:\s*["']\.\/drizzle-postgres["']/);
  assert.match(config, /dialect:\s*["']postgresql["']/);
  assert.doesNotMatch(config, /(?:^|["'`])\.\/drizzle(?:["'`/])/m);
  await assert.rejects(access(path.join(root, "drizzle")));
  await assert.rejects(access(path.join(root, "examples", "d1")));
});

function runDbCheck() {
  return spawnSync("npm", ["run", "db:check"], { cwd: root, encoding: "utf8" });
}

test("db:check rejects manually modified tracked migration and config files", async () => {
  const migrationPath = path.join(root, "drizzle-postgres", "0000_freezing_gambit.sql");
  const configPath = path.join(root, "drizzle.config.ts");
  const migration = await readFile(migrationPath);
  const config = await readFile(configPath);
  try {
    await writeFile(migrationPath, Buffer.concat([migration, Buffer.from("\n-- db:check regression\n")]));
    let result = runDbCheck();
    assert.notEqual(result.status, 0);
    assert.match(`${result.stdout}\n${result.stderr}`, /differ from HEAD before generation/);

    await writeFile(migrationPath, migration);
    await writeFile(configPath, Buffer.concat([config, Buffer.from("\n// db:check regression\n")]));
    result = runDbCheck();
    assert.notEqual(result.status, 0);
    assert.match(`${result.stdout}\n${result.stderr}`, /differ from HEAD before generation/);
  } finally {
    await writeFile(migrationPath, migration);
    await writeFile(configPath, config);
  }
});

test("db:check rejects an untracked PostgreSQL migration artifact", async () => {
  const artifactPath = path.join(root, "drizzle-postgres", "db-check-untracked-artifact.sql");
  try {
    await writeFile(artifactPath, "-- untracked regression artifact\n");
    const result = runDbCheck();
    assert.notEqual(result.status, 0);
    assert.match(`${result.stdout}\n${result.stderr}`, /differ from HEAD before generation/);
  } finally {
    await rm(artifactPath, { force: true });
  }
});

test("db:check includes a path-scoped Git index and worktree comparison", async () => {
  const checker = await readFile(path.join(root, "scripts/check-postgres-migration.mjs"), "utf8");
  assert.match(checker, /\["diff", "--name-status", "--find-renames", "HEAD", "--", \.\.\.guardedPaths\]/);
  assert.match(checker, /index\/worktree/);
});

test("SQLite test adapter normalizes PostgreSQL boolean binds", async () => {
  const { db, sqlite } = createSqliteTestDatabase();
  await db.insert(schema.sources).values({
    slug: "adapter-source",
    displayName: "Adapter Source",
    market: "US",
    region: "US",
    currency: "USD",
    baseUrl: "https://example.com",
    enabled: true,
  });
  await db.insert(schema.sources).values({
    slug: "adapter-source",
    displayName: "Adapter Source",
    market: "US",
    region: "US",
    currency: "USD",
    baseUrl: "https://example.com",
    enabled: false,
  }).onConflictDoUpdate({ target: schema.sources.slug, set: { enabled: false } });
  assert.equal(sqlite.prepare("SELECT enabled FROM sources WHERE slug = 'adapter-source'").get().enabled, 0);
});
