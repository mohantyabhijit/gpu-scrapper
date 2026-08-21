import { authenticateRefreshRequest } from "../../../lib/brightdata/refresh.ts";
import { MarketPackValidationError, upsertMarketPack } from "../../../lib/d1/market-packs.ts";
import type { RasterDatabase } from "../../../lib/d1/repository.ts";
import { replayAcquired, releaseReplayClaim, type ReplayGuard, type ReplayClaim } from "../../../lib/d1/replay.ts";
import { readBoundedBody, RequestBodyTooLargeError } from "../../../lib/http/bounded-body.ts";

type Environment = { RASTER_INGEST_HMAC_SECRET?: string };

function runtimeEnvironment(): Environment {
  const runtime = globalThis as typeof globalThis & { RASTER_ENV?: Environment };
  if (runtime.RASTER_ENV) return runtime.RASTER_ENV;
  const processEnvironment = typeof process !== "undefined" ? process.env : undefined;
  return { RASTER_INGEST_HMAC_SECRET: processEnvironment?.RASTER_INGEST_HMAC_SECRET };
}

function json(payload: unknown, status = 200) {
  return Response.json(payload, { status, headers: { "Cache-Control": "no-store" } });
}

export async function handleMarketPackRequest(
  request: Request,
  dependencies: { environment: Environment; db?: RasterDatabase; nowSeconds?: number; now?: Date; replayGuard?: ReplayGuard },
): Promise<Response> {
  let body: string;
  try {
    body = await readBoundedBody(request, 64 * 1024);
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
  let parsed: unknown;
  try { parsed = JSON.parse(body); } catch { return json({ error: "Request body is invalid JSON" }, 400); }
  let replayClaim: boolean | ReplayClaim | undefined;
  try {
    const db = dependencies.db ?? (await import("../../../db/index.ts")).getDb();
    replayClaim = timestamp ? await (dependencies.replayGuard ?? (await import("../../../lib/d1/replay.ts")).createReplayGuard(db))("market-packs", timestamp, body) : false;
    if (!timestamp || !replayAcquired(replayClaim)) {
      return json({ error: "replayed_request" }, 409);
    }
    const result = await upsertMarketPack(db, parsed, dependencies.now ?? new Date());
    return json(result, 200);
  } catch (error) {
    await releaseReplayClaim(replayClaim);
    if (error instanceof MarketPackValidationError) return json({ error: error.message }, 400);
    return json({ error: "market_pack_unavailable" }, 503);
  }
}

export async function POST(request: Request): Promise<Response> {
  return handleMarketPackRequest(request, { environment: runtimeEnvironment() });
}
