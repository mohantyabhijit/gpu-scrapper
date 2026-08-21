import {
  authenticateRefreshRequest,
  createRefreshRunner,
  parseRefreshRequest,
  RefreshRequestError,
  type RefreshEnvironment,
} from "../../../lib/brightdata/refresh.ts";

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

export async function handleRefreshRequest(
  request: Request,
  dependencies: {
    environment: RefreshEnvironment;
    nowSeconds?: number;
    runner?: ReturnType<typeof createRefreshRunner>;
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
    const runner = dependencies.runner ?? createRefreshRunner(dependencies.environment);
    const result = await runner(parsed);
    return json(result, result.completed.length > 0 || result.notConfigured.length > 0 ? 200 : 502);
  } catch {
    return json({ error: "refresh_unavailable" }, 503);
  }
}

export async function POST(request: Request): Promise<Response> {
  return handleRefreshRequest(request, { environment: runtimeEnvironment() });
}
