import assert from "node:assert/strict";
import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

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
