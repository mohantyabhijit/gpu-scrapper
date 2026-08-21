import {
  collectorForSource,
  createBrightDataClient,
  BrightDataError,
  type BrightDataClientOptions,
  type BrightDataRun,
} from "./client.ts";
import {
  getSource,
  isKnownSource,
  sourceRegistry,
  type CollectorRole,
  type SourceDefinition,
  type SourceSlug,
} from "../../config/sources.ts";

// One signed request owns one source. Multi-site refreshes are dispatched as
// independently signed slices so a slow retailer cannot outlive a batch lease.
export const MAX_REFRESH_SOURCES = 1;
export const REPLAY_WINDOW_SECONDS = 300;

export type RefreshEnvironment = {
  BRIGHTDATA_API_KEY?: string;
  RASTER_INGEST_HMAC_SECRET?: string;
};

export type RefreshRequest = { sourceSlugs: SourceSlug[]; role: CollectorRole };

export type RefreshSuccess = {
  sourceSlug: SourceSlug;
  collectorId: string;
  responseId: string;
  runId: string;
  observedAt: string;
  rowCount: number;
  attempts: number;
};

export type RefreshResult = {
  requested: SourceSlug[];
  completed: RefreshSuccess[];
  notConfigured: SourceSlug[];
  failed: Array<{ sourceSlug: SourceSlug; code: string }>;
};

export class RefreshRequestError extends Error {}

export type RefreshCompletionInput = {
  sourceSlug: SourceSlug;
  collectorId: string;
  responseId: string;
  rows: unknown[];
  runId: string;
  observedAt: string;
  source: SourceDefinition;
};

export type RefreshCompletion = (input: RefreshCompletionInput) => void | Promise<void>;

export type RefreshRunnerOptions = {
  onComplete?: RefreshCompletion;
  now?: () => Date;
  resolveSource?: SourceResolver;
};

export type SourceResolver = (slug: string) => SourceDefinition | undefined | Promise<SourceDefinition | undefined>;

const roles = new Set<CollectorRole>(["discovery", "pdp", "combined"]);

export function parseRefreshRequest(raw: unknown): RefreshRequest {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new RefreshRequestError("Request body must be an object");
  }
  const body = raw as Record<string, unknown>;
  const sourceSlugs = body.sourceSlugs;
  const role = body.role ?? "combined";
  if (!Array.isArray(sourceSlugs) || sourceSlugs.length < 1 || sourceSlugs.length > MAX_REFRESH_SOURCES) {
    throw new RefreshRequestError(`sourceSlugs must contain 1-${MAX_REFRESH_SOURCES} registered sources`);
  }
  if (sourceSlugs.some((slug) => typeof slug !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 64)) {
    throw new RefreshRequestError("sourceSlugs contains an invalid source slug");
  }
  const unique = [...new Set(sourceSlugs)] as SourceSlug[];
  if (unique.length !== sourceSlugs.length) throw new RefreshRequestError("sourceSlugs must not contain duplicates");
  if (typeof role !== "string" || !roles.has(role as CollectorRole)) throw new RefreshRequestError("role is invalid");
  for (const key of ["url", "urls", "input", "inputs", "collectorId", "collectorIds"]) {
    if (key in body) throw new RefreshRequestError("Only registered source slugs may be requested");
  }
  return { sourceSlugs: unique, role: role as CollectorRole };
}

export async function authenticateRefreshRequest(
  timestamp: string | null,
  signature: string | null,
  body: string,
  secret: string | undefined,
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<boolean> {
  if (!secret || !timestamp || !signature || !/^\d+$/.test(timestamp)) return false;
  const timestampNumber = Number(timestamp);
  if (!Number.isSafeInteger(timestampNumber) || Math.abs(nowSeconds - timestampNumber) > REPLAY_WINDOW_SECONDS) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const bytes = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${body}`));
  const expected = [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  const provided = signature.replace(/^sha256=/i, "").toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(provided) || provided.length !== expected.length) return false;
  let different = 0;
  for (let index = 0; index < expected.length; index += 1) {
    different |= expected.charCodeAt(index) ^ provided.charCodeAt(index);
  }
  return different === 0;
}

function safeRunId(sourceSlug: SourceSlug, responseId: string, observedAt: string): string {
  const suffix = `${sourceSlug}-${responseId}-${observedAt}`
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 180);
  return `run-${suffix || sourceSlug}`;
}

export function createRefreshRunner(
  environment: RefreshEnvironment,
  clientOptions: Omit<BrightDataClientOptions, "apiKey"> = {},
  runnerOptions: RefreshRunnerOptions = {},
) {
  return async function runRefresh(request: RefreshRequest): Promise<RefreshResult> {
    const completed: RefreshSuccess[] = [];
    const notConfigured: SourceSlug[] = [];
    const failed: RefreshResult["failed"] = [];
    const configured: Array<{ sourceSlug: SourceSlug; collectorId: string; inputUrl: string; source: SourceDefinition }> = [];
    const resolveSource = runnerOptions.resolveSource ?? ((slug: string) => isKnownSource(slug) ? getSource(slug) : undefined);
    for (const sourceSlug of request.sourceSlugs) {
      const source = await resolveSource(sourceSlug);
      if (!source || source.slug !== sourceSlug) {
        notConfigured.push(sourceSlug);
        continue;
      }
      const collectorId = collectorForSource(source, request.role);
      if (!source.enabled || !collectorId) {
        notConfigured.push(sourceSlug);
        continue;
      }
      configured.push({ sourceSlug, collectorId, inputUrl: source.catalogUrl, source });
    }
    let client: ReturnType<typeof createBrightDataClient>;
    try {
      client = createBrightDataClient({ ...clientOptions, apiKey: environment.BRIGHTDATA_API_KEY });
    } catch (error) {
      const code = error instanceof BrightDataError ? error.code : "not_configured";
      for (const source of configured) failed.push({ sourceSlug: source.sourceSlug, code });
      return { requested: request.sourceSlugs, completed, notConfigured, failed };
    }
    for (const source of configured) {
      try {
        const run: BrightDataRun = await client.triggerAndPoll({
          sourceSlug: source.sourceSlug,
          collectorId: source.collectorId,
          inputUrl: source.inputUrl,
        });
        const observedAt = (runnerOptions.now ?? (() => new Date()))().toISOString();
        const runId = safeRunId(source.sourceSlug, run.responseId, observedAt);
        try {
          await runnerOptions.onComplete?.({
            sourceSlug: source.sourceSlug,
            collectorId: run.collectorId,
            responseId: run.responseId,
            rows: run.rows,
            runId,
            observedAt,
            source: source.source,
          });
        } catch {
          failed.push({ sourceSlug: source.sourceSlug, code: "persistence_error" });
          continue;
        }
        completed.push({
          sourceSlug: source.sourceSlug,
          collectorId: run.collectorId,
          responseId: run.responseId,
          runId,
          observedAt,
          rowCount: run.rows.length,
          attempts: run.attempts,
        });
      } catch (error) {
        failed.push({
          sourceSlug: source.sourceSlug,
          code: error instanceof BrightDataError ? error.code : "provider_error",
        });
      }
    }
    return { requested: request.sourceSlugs, completed, notConfigured, failed };
  };
}

export function configuredSourceSlugs(): SourceSlug[] {
  return Object.values(sourceRegistry)
    .filter((source) => source.enabled && Object.keys(source.collectorIds).length > 0)
    .map((source) => source.slug as SourceSlug);
}
