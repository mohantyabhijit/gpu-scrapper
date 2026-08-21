import {
  authenticateRefreshRequest,
  createRefreshRunner,
  parseRefreshRequest,
  RefreshRequestError,
  type RefreshCompletionInput,
  type RefreshEnvironment,
  type RefreshFailure,
  type SourceResolver,
} from "../../../lib/brightdata/refresh.ts";
import type { RawOffer } from "../../../scrapers/contracts.ts";
import { getSource, isKnownSource } from "../../../config/sources.ts";
import { completeReplayClaim, replayAcquired, releaseReplayClaim, type RateClaim, type ReplayGuard, type ReplayClaim, type SourceRateGuard } from "../../../lib/postgres/replay.ts";
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
  // the same validator, normalizer, and PostgreSQL boundary before the route reports it.
  const [{ getDb }, { ingestRows }, { persistIngestion }] = await Promise.all([
    import("../../../db/index.ts"),
    import("../../../lib/ingest.ts"),
    import("../../../lib/postgres/repository.ts"),
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
    collectorId: input.collectorId,
    responseId: input.responseId,
    startedAt: input.observedAt,
    finishedAt: input.observedAt,
    observedAt: input.observedAt,
    source: input.source,
  });
}

async function persistFailedRun(input: Parameters<RefreshFailure>[0]): Promise<void> {
  // Keep the failure boundary server-only and lazy for the same reason as the
  // success path: injected runner tests must not load a database binding.
  const [{ getDb }, { persistSourceFailure }] = await Promise.all([
    import("../../../db/index.ts"),
    import("../../../lib/postgres/repository.ts"),
  ]);
  await persistSourceFailure(getDb(), input);
}

export async function handleRefreshRequest(
  request: Request,
  dependencies: {
    environment: RefreshEnvironment;
    nowSeconds?: number;
    runner?: ReturnType<typeof createRefreshRunner>;
    runnerFactory?: typeof createRefreshRunner;
    onFailure?: RefreshFailure;
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
    const createRunner = dependencies.runnerFactory ?? createRefreshRunner;
    const runner = dependencies.runner ?? createRunner(
      dependencies.environment,
      {},
      {
        onComplete: persistCompletedRun,
        onFailure: dependencies.onFailure ?? persistFailedRun,
        resolveSource: dependencies.resolveSource ?? runtimeSourceResolver(),
      },
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
      const [{ getDb }, { createPostgresSourceResolver }] = await Promise.all([
        import("../../../db/index.ts"),
        import("../../../lib/postgres/repository.ts"),
      ]);
      return createPostgresSourceResolver(getDb())(slug);
    } catch {
      return isKnownSource(slug) ? getSource(slug) : undefined;
    }
  };
}

function runtimeReplayGuard(): ReplayGuard {
  return async (route, timestamp, body) => {
    const [{ getDb }, { createReplayGuard }] = await Promise.all([
      import("../../../db/index.ts"),
      import("../../../lib/postgres/replay.ts"),
    ]);
    return createReplayGuard(getDb())(route, timestamp, body);
  };
}

const allowSourceRate: SourceRateGuard = async () => ({ acquired: true, retryAfterSeconds: 0, complete: async () => {} });

function runtimeSourceRateGuard(): SourceRateGuard {
  return async (sourceSlug) => {
    const [{ getDb }, { createSourceRateGuard }] = await Promise.all([
      import("../../../db/index.ts"),
      import("../../../lib/postgres/replay.ts"),
    ]);
    return createSourceRateGuard(getDb())(sourceSlug);
  };
}
