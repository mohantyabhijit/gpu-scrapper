import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const guardedPaths = ["drizzle-postgres", "db/schema.ts", "drizzle.config.ts"];

async function snapshot(relativePath) {
  const absolutePath = path.join(root, relativePath);
  const entries = [];
  async function visit(current, prefix) {
    let info;
    try {
      info = await stat(current);
    } catch (error) {
      if (error?.code === "ENOENT") return;
      throw error;
    }
    if (info.isDirectory()) {
      const children = (await readdir(current)).sort();
      for (const child of children) await visit(path.join(current, child), path.join(prefix, child));
      return;
    }
    const bytes = await readFile(current);
    entries.push(`${prefix}\0${createHash("sha256").update(bytes).digest("hex")}`);
  }
  await visit(absolutePath, relativePath);
  return entries.sort().join("\n");
}

async function takeSnapshot() {
  return Promise.all(guardedPaths.map(async (relativePath) => [relativePath, await snapshot(relativePath)]));
}

function runGenerate() {
  return new Promise((resolve, reject) => {
    const child = spawn("npm", ["run", "db:generate"], { cwd: root, stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (signal) reject(new Error(`db:generate terminated by ${signal}`));
      else if (code !== 0) reject(new Error(`db:generate exited with status ${code}`));
      else resolve();
    });
  });
}

const before = await takeSnapshot();
await runGenerate();
const after = await takeSnapshot();
const changed = after.filter(([, digest], index) => digest !== before[index][1]).map(([relativePath]) => relativePath);
if (changed.length > 0) {
  console.error(`PostgreSQL migration generation changed guarded paths: ${changed.join(", ")}`);
  console.error("Review the generated migration and commit it deliberately before rerunning db:check.");
  process.exitCode = 1;
} else {
  console.log("PostgreSQL migration generation is deterministic; guarded paths are unchanged.");
}
