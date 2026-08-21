import { readFile } from "node:fs/promises";
import { createHealingProof, resolveSafeOutputPath, type HealingBaseline } from "../lib/evidence/healing-harness.ts";

type Arguments = {
  baseline: string;
  preview: string;
  after: string;
  repoRoot: string;
  output?: string;
};

function usage(): never {
  throw new Error("usage: node --experimental-strip-types scripts/heal-source.ts --baseline <path> --preview <path> --after <path> [--repo-root <path>] [--output <path>]");
}

function parseArgs(argv: readonly string[]): Arguments {
  const values: Partial<Arguments> = { repoRoot: process.cwd() };
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key.startsWith("--") || !value || value.startsWith("--")) usage();
    index += 1;
    if (key === "--baseline") values.baseline = value;
    else if (key === "--preview") values.preview = value;
    else if (key === "--after") values.after = value;
    else if (key === "--repo-root") values.repoRoot = value;
    else if (key === "--output") values.output = value;
    else usage();
  }
  if (!values.baseline || !values.preview || !values.after || !values.repoRoot) usage();
  return values as Arguments;
}

async function writeOutput(outputPath: string | undefined, repoRoot: string, payload: unknown): Promise<void> {
  const serialized = `${JSON.stringify(payload, null, 2)}\n`;
  if (!outputPath) {
    process.stdout.write(serialized);
    return;
  }
  const output = await resolveSafeOutputPath(repoRoot, outputPath);
  const { writeFile } = await import("node:fs/promises");
  await writeFile(output, serialized, "utf8");
}

async function readBaseline(repoRoot: string, baselinePath: string): Promise<HealingBaseline> {
  const pathModule = await import("node:path");
  if (pathModule.isAbsolute(baselinePath)) throw new Error("baseline path must be repository-relative");
  const file = pathModule.resolve(repoRoot, baselinePath);
  if (!file.startsWith(`${pathModule.resolve(repoRoot)}${pathModule.sep}`)) throw new Error("baseline path must stay inside repo root");
  try {
    return JSON.parse(await readFile(file, "utf8")) as HealingBaseline;
  } catch {
    throw new Error("baseline must be a readable JSON file");
  }
}

export async function main(argv = process.argv.slice(2)): Promise<void> {
  const args = parseArgs(argv);
  const baseline = await readBaseline(args.repoRoot, args.baseline);
  const proof = await createHealingProof({
    repoRoot: args.repoRoot,
    baseline,
    previewPath: args.preview,
    afterPath: args.after,
  });
  await writeOutput(args.output, args.repoRoot, proof);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : "healing proof failed"}\n`);
    process.exitCode = 1;
  });
}
