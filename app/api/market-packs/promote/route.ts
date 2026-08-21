import { authenticateRefreshRequest } from "../../../../lib/brightdata/refresh.ts";
import { MarketPackPromotionError, promoteMarketPack } from "../../../../lib/postgres/market-packs.ts";
import type { RasterDatabase } from "../../../../lib/postgres/repository.ts";
import { completeReplayClaim, replayAcquired, releaseReplayClaim, type ReplayClaim, type ReplayGuard } from "../../../../lib/postgres/replay.ts";
import { readBoundedBody, RequestBodyTooLargeError } from "../../../../lib/http/bounded-body.ts";

type Environment = { RASTER_INGEST_HMAC_SECRET?: string };
function json(payload: unknown, status = 200) { return Response.json(payload, { status, headers: { "Cache-Control": "no-store" } }); }
export async function handleMarketPackPromotionRequest(request: Request, dependencies: { environment: Environment; db?: RasterDatabase; nowSeconds?: number; replayGuard?: ReplayGuard; promote?: typeof promoteMarketPack }): Promise<Response> {
  let body: string; try { body = await readBoundedBody(request, 8 * 1024); } catch (error) { return json({ error: error instanceof RequestBodyTooLargeError ? "request_too_large" : "request_unavailable" }, error instanceof RequestBodyTooLargeError ? 413 : 400); }
  const timestamp = request.headers.get("x-raster-timestamp"); if (!await authenticateRefreshRequest(timestamp, request.headers.get("x-raster-signature"), body, dependencies.environment.RASTER_INGEST_HMAC_SECRET, dependencies.nowSeconds)) return json({ error: "unauthorized" }, 401);
  let parsed: unknown; try { parsed = JSON.parse(body); } catch { return json({ error: "Request body is invalid JSON" }, 400); }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) || Object.keys(parsed as object).length !== 1 || typeof (parsed as { slug?: unknown }).slug !== "string") return json({ error: "promotion accepts only pack slug" }, 400);
  let claim: boolean | ReplayClaim | undefined;
  try { const db = dependencies.db ?? (await import("../../../../db/index.ts")).getDb(); claim = timestamp ? await (dependencies.replayGuard ?? (await import("../../../../lib/postgres/replay.ts")).createReplayGuard(db))("market-pack-promote", timestamp, body) : false; if (!timestamp || !replayAcquired(claim)) return json({ error: "replayed_request" }, 409); const result = await (dependencies.promote ?? promoteMarketPack)(db, (parsed as { slug: string }).slug); await completeReplayClaim(claim); return json(result); } catch (error) { await releaseReplayClaim(claim); if (error instanceof MarketPackPromotionError) return json({ error: error.message }, 400); return json({ error: "market_pack_promotion_unavailable" }, 503); }
}
export async function POST(request: Request): Promise<Response> { const env = (globalThis as typeof globalThis & { RASTER_ENV?: Environment }).RASTER_ENV ?? { RASTER_INGEST_HMAC_SECRET: process.env.RASTER_INGEST_HMAC_SECRET }; return handleMarketPackPromotionRequest(request, { environment: env }); }
