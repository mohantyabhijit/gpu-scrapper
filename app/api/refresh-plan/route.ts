import { authenticateRefreshRequest } from "../../../lib/brightdata/refresh.ts";
import { queryRefreshPlan, type RasterDatabase } from "../../../lib/postgres/repository.ts";
import type { CollectorRole } from "../../../config/sources.ts";
import { readBoundedBody, RequestBodyTooLargeError } from "../../../lib/http/bounded-body.ts";

type Environment = { RASTER_INGEST_HMAC_SECRET?: string };
const roles = new Set<CollectorRole>(["discovery", "pdp", "combined"]);
function json(payload: unknown, status = 200) { return Response.json(payload, { status, headers: { "Cache-Control": "no-store" } }); }
function env(): Environment { return (globalThis as typeof globalThis & { RASTER_ENV?: Environment }).RASTER_ENV ?? { RASTER_INGEST_HMAC_SECRET: process.env.RASTER_INGEST_HMAC_SECRET }; }

export async function handleRefreshPlanRequest(request: Request, dependencies: { environment: Environment; db?: RasterDatabase; nowSeconds?: number; queryPlan?: typeof queryRefreshPlan }): Promise<Response> {
  let body: string;
  try { body = request.method === "GET" ? "" : await readBoundedBody(request, 8 * 1024); } catch (error) { return json({ error: error instanceof RequestBodyTooLargeError ? "request_too_large" : "request_unavailable" }, error instanceof RequestBodyTooLargeError ? 413 : 400); }
  if (!await authenticateRefreshRequest(request.headers.get("x-raster-timestamp"), request.headers.get("x-raster-signature"), body, dependencies.environment.RASTER_INGEST_HMAC_SECRET, dependencies.nowSeconds)) return json({ error: "unauthorized" }, 401);
  let role: CollectorRole = "combined";
  if (body) {
    let parsed: unknown; try { parsed = JSON.parse(body); } catch { return json({ error: "Request body is invalid JSON" }, 400); }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) || Object.keys(parsed as object).some((key) => key !== "role") || ((parsed as { role?: unknown }).role !== undefined && (typeof (parsed as { role?: unknown }).role !== "string" || !roles.has((parsed as { role: string }).role as CollectorRole)))) return json({ error: "role is invalid" }, 400);
    role = ((parsed as { role?: CollectorRole }).role ?? "combined");
  }
  try { const db = dependencies.db ?? (await import("../../../db/index.ts")).getDb(); return json(await (dependencies.queryPlan ?? queryRefreshPlan)(db, role)); } catch { return json({ error: "refresh_plan_unavailable" }, 503); }
}
export async function GET(request: Request): Promise<Response> { return handleRefreshPlanRequest(request, { environment: env() }); }
export async function POST(request: Request): Promise<Response> { return handleRefreshPlanRequest(request, { environment: env() }); }
