import { readFile } from "node:fs/promises";
import { validateCollectorOutput, type CollectorValidationSummary } from "../scrapers/contracts.ts";
import { isKnownSource } from "../config/sources.ts";

type Arguments = { input: string; source?: string };

function usage(): never {
  throw new Error("usage: node --experimental-strip-types scripts/validate-collector-output.ts --input <json-path> [--source <registered-slug>]");
}

export function parseValidatorArgs(argv: readonly string[]): Arguments {
  const values: Partial<Arguments> = {};
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || !value || value.startsWith("--")) usage();
    index += 1;
    if (key === "--input") values.input = value;
    else if (key === "--source" && isKnownSource(value)) values.source = value;
    else usage();
  }
  if (!values.input) usage();
  return values as Arguments;
}

function safeFailure(code: "invalid_json" | "read_failed"): CollectorValidationSummary & { errorCounts: Record<string, number> } {
  return {
    ok: false,
    rowCount: 0,
    acceptedCount: 0,
    rejectedCount: 0,
    errorCounts: { [code]: 1 },
  };
}

export async function validateCollectorFile(inputPath: string, expectedSource?: string): Promise<CollectorValidationSummary & { errorCounts: Record<string, number> }> {
  let payload: unknown;
  try {
    payload = JSON.parse(await readFile(inputPath, "utf8")) as unknown;
  } catch (error) {
    const code = error instanceof SyntaxError ? "invalid_json" : "read_failed";
    return safeFailure(code);
  }
  return validateCollectorOutput(payload, expectedSource) as CollectorValidationSummary & { errorCounts: Record<string, number> };
}

export async function main(argv = process.argv.slice(2)): Promise<void> {
  const args = parseValidatorArgs(argv);
  const summary = await validateCollectorFile(args.input, args.source);
  process.stdout.write(`${JSON.stringify(summary)}\n`);
  if (!summary.ok) process.exitCode = 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(() => {
    process.stdout.write(`${JSON.stringify(safeFailure("read_failed"))}\n`);
    process.exitCode = 1;
  });
}
