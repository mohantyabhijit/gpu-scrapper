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
import { completeReplayClaim, replayAcquired, releaseReplayClaim, type RateClaim, type ReplayGuard, type ReplayClaim, type SourceRateGuard } from "../../../lib/d1/replay.ts";
import { readBoundedBody, RequestBodyTooLargeError } from "../../../lib/http/bounded-body.ts";

function runtimeEnvironment(): RefreshEnvironment {
  const runtime = globalThis as typeof globalThis & { RASTER_ENV?: RefreshEnvironment };
  if (runtime.RASTER_ENV) return runtime.RASTER_ENV;
  const processEnvironment = typeof process !== "undefined" ? process.env : undefined;
  return {
    BRIGHTDATA_API_KEY: processEnvironment?.BRIGHTDATA_API_KEY,
    RASTER_INGEST_HMAC_SECRET: processEnvironment?.RASTER_INGEST_HMAC_SECRET,
  };
}

function json(payload: unknown, status = 200, headers: HeadersInit = {}) {
  return Response.json(payload, { status, headers: { "Cache-Control": "no-store", ...headers } });
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
    replayGuard?: ReplayGuard;
    rateGuard?: SourceRateGuard;
  },
): Promise<Response> {
  let body: string;
  try {
    body = await readBoundedBody(request, 8 * 1024);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) return json({ error: "request_too_large" }, 413);
    return json({ error: "request_unavailable" }, 400);
  }
  const timestamp = request.headers.get("x-raster-timestamp");
  const authenticated = await authenticateRefreshRequest(
    timestamp,
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

  let replayClaim: boolean | ReplayClaim | undefined;
  let rateClaim: RateClaim | undefined;
  try {
    replayClaim = timestamp ? await (dependencies.replayGuard ?? runtimeReplayGuard())("refresh", timestamp, body) : false;
    if (!timestamp || !replayAcquired(replayClaim)) {
      return json({ error: "replayed_request" }, 409);
    }
    const rateGuard = dependencies.rateGuard ?? (dependencies.replayGuard ? allowSourceRate : runtimeSourceRateGuard());
    rateClaim = await rateGuard(parsed.sourceSlugs[0]);
    if (!rateClaim.acquired) {
      await releaseReplayClaim(replayClaim);
      return json(
        { error: "source_rate_limited", source: parsed.sourceSlugs[0] },
        429,
        { "Retry-After": String(rateClaim.retryAfterSeconds) },
      );
    }
    const runner = dependencies.runner ?? createRefreshRunner(
      dependencies.environment,
      {},
      { onComplete: persistCompletedRun, resolveSource: dependencies.resolveSource ?? runtimeSourceResolver() },
    );
    const result = await runner(parsed);
    const accepted = result.failed.length === 0 && (result.completed.length > 0 || result.notConfigured.length > 0);
    if (!accepted) await releaseReplayClaim(replayClaim);
    else await completeReplayClaim(replayClaim);
    await rateClaim.complete();
    return json(result, accepted ? 200 : 502);
  } catch {
    await releaseReplayClaim(replayClaim);
    try { await rateClaim?.complete(); } catch { /* preserve the sanitized route error */ }
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

function runtimeReplayGuard(): ReplayGuard {
  return async (route, timestamp, body) => {
    const [{ getDb }, { createReplayGuard }] = await Promise.all([
      import("../../../db/index.ts"),
      import("../../../lib/d1/replay.ts"),
    ]);
    return createReplayGuard(getDb())(route, timestamp, body);
  };
}

const allowSourceRate: SourceRateGuard = async () => ({ acquired: true, retryAfterSeconds: 0, complete: async () => {} });

function runtimeSourceRateGuard(): SourceRateGuard {
  return async (sourceSlug) => {
    const [{ getDb }, { createSourceRateGuard }] = await Promise.all([
      import("../../../db/index.ts"),
      import("../../../lib/d1/replay.ts"),
    ]);
    return createSourceRateGuard(getDb())(sourceSlug);
  };
}
