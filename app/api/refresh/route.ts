import {
  authenticateRefreshRequest,
  createRefreshRunner,
  parseRefreshRequest,
  RefreshRequestError,
  type RefreshCompletionInput,
  type RefreshEnvironment,
  type SourceResolver,
} from "../../../lib/brightdata/refresh.ts";
import type { RawOffer } from "../../../scrapers/contracts.ts";
import { getSource, isKnownSource } from "../../../config/sources.ts";

function runtimeEnvironment(): RefreshEnvironment {
  const runtime = globalThis as typeof globalThis & { RASTER_ENV?: RefreshEnvironment };
  if (runtime.RASTER_ENV) return runtime.RASTER_ENV;
  const processEnvironment = typeof process !== "undefined" ? process.env : undefined;
  return {
    BRIGHTDATA_API_KEY: processEnvironment?.BRIGHTDATA_API_KEY,
    RASTER_INGEST_HMAC_SECRET: processEnvironment?.RASTER_INGEST_HMAC_SECRET,
  };
}

function json(payload: unknown, status = 200) {
  return Response.json(payload, { status, headers: { "Cache-Control": "no-store" } });
}

async function persistCompletedRun(input: RefreshCompletionInput): Promise<void> {
  // Keep the Cloudflare binding import server-only and lazy so injected runner
  // tests do not need a worker runtime. Every completed provider run crosses
  // the same validator/normalizer/D1 boundary before the route reports it.
  const [{ getDb }, { ingestRows }, { persistIngestion }] = await Promise.all([
    import("../../../db/index.ts"),
    import("../../../lib/ingest.ts"),
    import("../../../lib/d1/repository.ts"),
  ]);
  const result = ingestRows(input.rows as RawOffer[], {
    runId: input.runId,
    observedAt: input.observedAt,
    expectedSource: input.sourceSlug,
    source: input.source,
  });
  await persistIngestion(getDb(), result, {
    runId: input.runId,
    sourceSlug: input.sourceSlug,
    startedAt: input.observedAt,
    finishedAt: input.observedAt,
    observedAt: input.observedAt,
    source: input.source,
  });
}

export async function handleRefreshRequest(
  request: Request,
  dependencies: {
    environment: RefreshEnvironment;
    nowSeconds?: number;
    runner?: ReturnType<typeof createRefreshRunner>;
    resolveSource?: SourceResolver;
  },
): Promise<Response> {
  const body = await request.text();
  const authenticated = await authenticateRefreshRequest(
    request.headers.get("x-raster-timestamp"),
    request.headers.get("x-raster-signature"),
    body,
    dependencies.environment.RASTER_INGEST_HMAC_SECRET,
    dependencies.nowSeconds,
  );
  if (!authenticated) return json({ error: "unauthorized" }, 401);

  let parsed: ReturnType<typeof parseRefreshRequest>;
  try {
    parsed = parseRefreshRequest(JSON.parse(body));
  } catch (error) {
    const message = error instanceof RefreshRequestError ? error.message : "Request body is invalid JSON";
    return json({ error: message }, 400);
  }

  if (!dependencies.environment.BRIGHTDATA_API_KEY) {
    return json({ error: "bright_data_not_configured", requested: parsed.sourceSlugs }, 503);
  }

  try {
    const runner = dependencies.runner ?? createRefreshRunner(
      dependencies.environment,
      {},
      { onComplete: persistCompletedRun, resolveSource: dependencies.resolveSource ?? runtimeSourceResolver() },
    );
    const result = await runner(parsed);
    return json(result, result.completed.length > 0 || result.notConfigured.length > 0 ? 200 : 502);
  } catch {
    return json({ error: "refresh_unavailable" }, 503);
  }
}

export async function POST(request: Request): Promise<Response> {
  return handleRefreshRequest(request, { environment: runtimeEnvironment() });
}

function runtimeSourceResolver(): SourceResolver {
  return async (slug) => {
    try {
      const [{ getDb }, { createD1SourceResolver }] = await Promise.all([
        import("../../../db/index.ts"),
        import("../../../lib/d1/repository.ts"),
      ]);
      return createD1SourceResolver(getDb())(slug);
    } catch {
      return isKnownSource(slug) ? getSource(slug) : undefined;
    }
  };
}
