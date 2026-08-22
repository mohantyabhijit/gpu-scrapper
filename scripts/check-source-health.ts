import { createHealingBaseline, HEALING_REQUIRED_FIELDS, resolveSafeOutputPath, type HealingFailureMode, type HealingRequiredField } from "../lib/evidence/healing-harness.ts";

type Arguments = {
  source: string;
  collector: string;
  inputUrl: string;
  requiredField: HealingRequiredField;
  failureMode: HealingFailureMode;
  before: string;
  consumer: string[];
  repoRoot: string;
  output?: string;
};

function usage(): never {
  throw new Error("usage: node --experimental-strip-types scripts/check-source-health.ts --source <slug> --collector <c_id> --input-url <https-url> --required-field <field> [--failure-mode required_field|empty_output] --before <path> --consumer <path> [--consumer <path>] [--repo-root <path>] [--output <path>]");
}

export function parseSourceHealthArgs(argv: readonly string[]): Arguments {
  const values: Partial<Arguments> = { consumer: [], repoRoot: process.cwd(), failureMode: "required_field" };
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key.startsWith("--") || !value || value.startsWith("--")) usage();
    index += 1;
    if (key === "--source") values.source = value;
    else if (key === "--collector") values.collector = value;
    else if (key === "--input-url") values.inputUrl = value;
    else if (key === "--required-field" && HEALING_REQUIRED_FIELDS.includes(value as HealingRequiredField)) values.requiredField = value as HealingRequiredField;
    else if (key === "--failure-mode" && (value === "required_field" || value === "empty_output")) values.failureMode = value;
    else if (key === "--before") values.before = value;
    else if (key === "--consumer") values.consumer?.push(value);
    else if (key === "--repo-root") values.repoRoot = value;
    else if (key === "--output") values.output = value;
    else usage();
  }
  if (!values.source || !values.collector || !values.inputUrl || !values.requiredField || !values.before || !values.consumer?.length || !values.repoRoot) usage();
  return values as Arguments;
}

async function writeOutput(outputPath: string | undefined, repoRoot: string, payload: unknown): Promise<void> {
  const serialized = `${JSON.stringify(payload, null, 2)}\n`;
  if (!outputPath) {
    process.stdout.write(serialized);
    return;
  }
  const path = await resolveSafeOutputPath(repoRoot, outputPath);
  const { writeFile } = await import("node:fs/promises");
  await writeFile(path, serialized, "utf8");
}

export async function main(argv = process.argv.slice(2)): Promise<void> {
  const args = parseSourceHealthArgs(argv);
  const baseline = await createHealingBaseline({
    sourceSlug: args.source,
    collectorId: args.collector,
    inputUrl: args.inputUrl,
    requiredField: args.requiredField,
    failureMode: args.failureMode,
    beforePath: args.before,
    downstreamPaths: args.consumer,
    repoRoot: args.repoRoot,
  });
  await writeOutput(args.output, args.repoRoot, baseline);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : "source health check failed"}\n`);
    process.exitCode = 1;
  });
}
