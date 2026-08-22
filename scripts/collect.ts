import {
  BrightDataError,
  collectorForSource,
  createBrightDataClient,
} from "../lib/brightdata/client.ts";
import {
  getSource,
  isKnownSource,
  type CollectorRole,
  type SourceDefinition,
} from "../config/sources.ts";
import { validateCollectorOutput } from "../scrapers/contracts.ts";
import { adaptDynacoreOutput } from "../scrapers/adapters/dynacore.ts";
import { adaptInfinityOutput } from "../scrapers/adapters/infinity-computer.ts";

type Arguments = { source: string; role: CollectorRole };
type CollectionTarget = {
  source: SourceDefinition;
  collectorId: string;
  inputUrl: string;
};

const roles = new Set<CollectorRole>(["discovery", "pdp", "combined"]);
const collectorIdPattern = /^c_[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;

function usage(): never {
  throw new Error("usage: node --experimental-strip-types scripts/collect.ts --source <registered-slug> [--role combined|discovery|pdp]");
}

export function parseCollectArgs(argv: readonly string[]): Arguments {
  const values: Partial<Arguments> = { role: "combined" };
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || !value || value.startsWith("--")) usage();
    index += 1;
    if (key === "--source" && isKnownSource(value)) values.source = value;
    else if (key === "--role" && roles.has(value as CollectorRole)) values.role = value as CollectorRole;
    else usage();
  }
  if (!values.source || !values.role) usage();
  return values as Arguments;
}

export function resolveCollectionTarget(sourceSlug: string, role: CollectorRole): CollectionTarget | undefined {
  if (!isKnownSource(sourceSlug) || !roles.has(role)) return undefined;
  const source = getSource(sourceSlug);
  if (!source.enabled || !source.collectorRoles.includes(role)) return undefined;
  const collectorId = collectorForSource(source, role);
  if (!collectorId || !collectorIdPattern.test(collectorId)) return undefined;
  return { source, collectorId, inputUrl: source.catalogUrl };
}

function summary(source: string, role: CollectorRole, status: string, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    status,
    source_slug: source,
    role,
    row_count: 0,
    accepted_count: 0,
    rejected_count: 0,
    error_counts: {},
    ...extra,
  };
}

export async function collectSource(args: Arguments): Promise<Record<string, unknown>> {
  const target = resolveCollectionTarget(args.source, args.role);
  if (!target) return summary(args.source, args.role, "not_configured");
  let run;
  try {
    // The key is read only from the process environment and is never included
    // in a result, error, or log line.
    const client = createBrightDataClient({ apiKey: process.env.BRIGHTDATA_API_KEY });
    run = await client.triggerAndPoll({
      sourceSlug: target.source.slug,
      collectorId: target.collectorId,
      inputUrl: target.inputUrl,
    });
  } catch (error) {
    const code = error instanceof BrightDataError ? error.code : "provider_error";
    return summary(args.source, args.role, code);
  }
  const rows = target.source.slug === "dynacore"
    ? adaptDynacoreOutput(run.rows, { collectorId: target.collectorId }).payload
    : target.source.slug === "infinity-computer"
      ? adaptInfinityOutput(run.rows, { collectorId: target.collectorId }).payload
      : run.rows;
  const validation = validateCollectorOutput(rows, target.source.slug);
  return {
    status: validation.ok ? "completed" : "invalid_output",
    source_slug: args.source,
    role: args.role,
    row_count: validation.rowCount,
    accepted_count: validation.acceptedCount,
    rejected_count: validation.rejectedCount,
    error_counts: validation.errorCounts,
  };
}

export async function main(argv = process.argv.slice(2)): Promise<void> {
  const args = parseCollectArgs(argv);
  const result = await collectSource(args);
  process.stdout.write(`${JSON.stringify(result)}\n`);
  if (result.status !== "completed") process.exitCode = 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(() => {
    process.stdout.write(`${JSON.stringify(summary("unknown", "combined", "invalid_arguments"))}\n`);
    process.exitCode = 1;
  });
}
