import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import { execFileSync, spawn } from "node:child_process";
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
  return new Map(entries.map((entry) => {
    const separator = entry.indexOf("\0");
    return [entry.slice(0, separator), entry.slice(separator + 1)];
  }));
}

function headSnapshot() {
  const output = execFileSync("git", ["ls-tree", "-r", "--name-only", "HEAD", "--", ...guardedPaths], { cwd: root, encoding: "utf8" });
  const files = output.split("\n").map((file) => file.trim()).filter(Boolean);
  return new Map(files.map((relativePath) => [relativePath, createHash("sha256").update(execFileSync("git", ["show", `HEAD:${relativePath}`], { cwd: root })).digest("hex")]));
}

function gitDirtyPaths() {
  const output = execFileSync("git", ["diff", "--name-status", "--find-renames", "HEAD", "--", ...guardedPaths], { cwd: root, encoding: "utf8" });
  return output.split("\n").map((line) => line.trim()).filter(Boolean);
}

async function takeSnapshot() {
  const snapshots = await Promise.all(guardedPaths.map((relativePath) => snapshot(relativePath)));
  return new Map(snapshots.flatMap((current) => [...current]));
}

function differences(actual, expected) {
  const paths = new Set([...actual.keys(), ...expected.keys()]);
  return [...paths].filter((relativePath) => actual.get(relativePath) !== expected.get(relativePath)).sort();
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

const head = headSnapshot();
const before = await takeSnapshot();
const preexisting = differences(before, head);
const gitDirty = gitDirtyPaths();
if (preexisting.length > 0 || gitDirty.length > 0) {
  if (gitDirty.length > 0) console.error(`Git reports guarded PostgreSQL paths dirty against HEAD (index/worktree): ${gitDirty.join(", ")}`);
  if (preexisting.length > 0) console.error(`Guarded PostgreSQL paths differ from HEAD before generation: ${preexisting.join(", ")}`);
  console.error("Commit or revert guarded schema/config/migration changes before rerunning db:check.");
  process.exit(1);
}
await runGenerate();
const after = await takeSnapshot();
const changed = differences(after, before);
if (changed.length > 0) {
  console.error(`PostgreSQL migration generation changed guarded paths: ${changed.join(", ")}`);
  console.error("Review the generated migration and commit it deliberately before rerunning db:check.");
  process.exitCode = 1;
} else {
  console.log("PostgreSQL migration generation is deterministic; guarded paths are unchanged.");
}
