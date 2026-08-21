import { authenticateRefreshRequest } from "../../../lib/brightdata/refresh.ts";
import {
  HealingEvidenceValidationError,
  recordHealingEvent,
} from "../../../lib/d1/healing-evidence.ts";
import type { RasterDatabase } from "../../../lib/d1/repository.ts";
import { completeReplayClaim, replayAcquired, releaseReplayClaim, type ReplayGuard, type ReplayClaim } from "../../../lib/d1/replay.ts";
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

type Dependencies = {
  environment: Environment;
  db?: RasterDatabase;
  nowSeconds?: number;
  now?: Date;
  replayGuard?: ReplayGuard;
  recordEvent?: typeof recordHealingEvent;
};

export async function handleHealEvidenceRequest(request: Request, dependencies: Dependencies): Promise<Response> {
  let body: string;
  try {
    body = await readBoundedBody(request, 32 * 1024);
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
    replayClaim = timestamp ? await (dependencies.replayGuard ?? (await import("../../../lib/d1/replay.ts")).createReplayGuard(db))("heal-evidence", timestamp, body) : false;
    if (!timestamp || !replayAcquired(replayClaim)) {
      return json({ error: "replayed_request" }, 409);
    }
    const result = await (dependencies.recordEvent ?? recordHealingEvent)(db, parsed, dependencies.now ?? new Date());
    await completeReplayClaim(replayClaim);
    return json(result);
  } catch (error) {
    await releaseReplayClaim(replayClaim);
    if (error instanceof HealingEvidenceValidationError) return json({ error: error.message }, 400);
    return json({ error: "heal_evidence_unavailable" }, 503);
  }
}

export async function POST(request: Request): Promise<Response> {
  return handleHealEvidenceRequest(request, { environment: runtimeEnvironment() });
}
