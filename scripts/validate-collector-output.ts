import { readFile } from "node:fs/promises";
import { validateCollectorOutput, type CollectorValidationSummary } from "../scrapers/contracts.ts";
import { adaptDynacoreOutput } from "../scrapers/adapters/dynacore.ts";
import { adaptInfinityOutput } from "../scrapers/adapters/infinity-computer.ts";
import { adaptPcThemesOutput } from "../scrapers/adapters/pc-themes.ts";
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

type ValidatorFileSummary = CollectorValidationSummary & {
  errorCounts: Record<string, number>;
  adapter_result?: "not_applied" | "passed" | "failed";
  adapter_rejected_count?: number;
};

function safeFailure(code: "invalid_json" | "read_failed" | "adapter_invalid_output"): ValidatorFileSummary {
  return {
    ok: false,
    rowCount: 0,
    acceptedCount: 0,
    rejectedCount: 0,
    errorCounts: { [code]: 1 },
  };
}

export async function validateCollectorFile(inputPath: string, expectedSource?: string): Promise<ValidatorFileSummary> {
  let payload: unknown;
  try {
    payload = JSON.parse(await readFile(inputPath, "utf8")) as unknown;
  } catch (error) {
    const code = error instanceof SyntaxError ? "invalid_json" : "read_failed";
    return safeFailure(code);
  }
  if (expectedSource === "dynacore" || expectedSource === "infinity-computer" || expectedSource === "pc-themes") {
    try {
      const capture = expectedSource === "dynacore"
        ? adaptDynacoreOutput(payload)
        : expectedSource === "infinity-computer"
          ? adaptInfinityOutput(payload)
          : adaptPcThemesOutput(payload);
      const validation = validateCollectorOutput(capture.payload, expectedSource);
      return {
        ...validation,
        adapter_result: validation.ok ? "passed" : "failed",
        adapter_rejected_count: capture.rejected.length,
      } as ValidatorFileSummary;
    } catch {
      return safeFailure("adapter_invalid_output");
    }
  }
  return {
    ...validateCollectorOutput(payload, expectedSource),
    adapter_result: "not_applied",
  } as ValidatorFileSummary;
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
