import { createHmac } from "node:crypto";

export const REFRESH_SLICES = Object.freeze({
  "us-central-computer": Object.freeze({ market: "US", sourceSlug: "central-computer" }),
  "uk-overclockers-uk": Object.freeze({ market: "UK", sourceSlug: "overclockers-uk" }),
  "in-md-computers": Object.freeze({ market: "IN", sourceSlug: "md-computers" }),
  "sg-dynacore": Object.freeze({ market: "SG", sourceSlug: "dynacore" }),
});

const SAFE_SOURCE_SLUGS = new Set(Object.values(REFRESH_SLICES).map(({ sourceSlug }) => sourceSlug));
const SAFE_CODES = new Set([
  "bright_data_not_configured",
  "database_error",
  "invalid_response",
  "internal_error",
  "not_configured",
  "persistence_error",
  "provider_error",
  "refresh_unavailable",
  "replayed_request",
  "request_too_large",
  "source_rate_limited",
  "timeout",
  "unauthorized",
]);
const SAFE_STATUSES = new Set(["completed", "empty", "failed", "not_configured", "partial", "pending", "ok"]);

// Server bound: 6m15s provider work + 1m validation/persistence margin.
export const MAX_TIMEOUT_MS = 435_000;
// Keep values rendered in the job summary useful without allowing an arbitrary
// provider response to smuggle huge numbers into logs or downstream tooling.
export const MAX_SUMMARY_INTEGER = 1_000_000_000;

export function summaryListLength(value) {
  return Array.isArray(value) ? Math.min(value.length, MAX_SUMMARY_INTEGER) : undefined;
}

export class RefreshResponseError extends Error {
  constructor(status, summary) {
    super(`refresh route returned HTTP ${status}`);
    this.name = "RefreshResponseError";
    this.summary = summary;
  }
}

export function parseSlice(value) {
  const slice = REFRESH_SLICES[value];
  if (!slice) throw new Error("unsupported refresh slice");
  return { ...slice, slice: value };
}

export function createPayload({ market, sourceSlug }) {
  if (!market) throw new Error("market is required");
  return JSON.stringify({ sourceSlugs: [sourceSlug], role: "combined" });
}

export function signatureFor({ secret, timestamp, body }) {
  if (typeof secret !== "string" || secret.length < 16) {
    throw new Error("refresh secret is missing or too short");
  }
  if (!Number.isSafeInteger(timestamp) || timestamp <= 0) {
    throw new Error("timestamp must be a positive integer");
  }
  return `sha256=${createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex")}`;
}

function parseArgs(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!argument.startsWith("--")) throw new Error("unexpected command-line argument");
    const key = argument.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`missing value for --${key}`);
    if (!["url", "slice", "timeout-ms"].includes(key)) throw new Error(`unsupported option --${key}`);
    values[key] = value;
    index += 1;
  }
  return values;
}

function safeResponseSummary(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { response: "non_json" };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { response: "non_object" };
  }
  const safeNonNegativeInteger = (value) => (
    Number.isSafeInteger(value) && value >= 0 && value <= MAX_SUMMARY_INTEGER ? value : undefined
  );
  const safeSourceSlug = (value) => typeof value === "string" && SAFE_SOURCE_SLUGS.has(value) ? value : undefined;
  const safeCode = (value) => typeof value === "string" && SAFE_CODES.has(value) ? value : "unknown_error";
  const safeObservedAt = (value) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value) ? value : undefined;
  if (["requested", "completed", "notConfigured", "failed"].some((key) => key in parsed)) {
    const completed = Array.isArray(parsed.completed) ? parsed.completed : [];
    const failed = Array.isArray(parsed.failed) ? parsed.failed : [];
    const notConfigured = Array.isArray(parsed.notConfigured) ? parsed.notConfigured : [];
    const safeCompleted = completed.slice(0, 1).map((item) => ({
      source_slug: safeSourceSlug(item?.sourceSlug),
      rows: safeNonNegativeInteger(item?.rowCount),
      observed_at: safeObservedAt(item?.observedAt),
      attempts: safeNonNegativeInteger(item?.attempts),
    }));
    const safeFailures = failed.slice(0, 1).map((item) => ({
      source_slug: safeSourceSlug(item?.sourceSlug),
      code: safeCode(item?.code),
    }));
    return {
      status: failed.length > 0 ? "failed" : completed.length > 0 ? "completed" : notConfigured.length > 0 ? "not_configured" : "empty",
      requested: summaryListLength(parsed.requested),
      completed: summaryListLength(parsed.completed),
      not_configured: summaryListLength(parsed.notConfigured),
      failed: summaryListLength(parsed.failed),
      rows: safeCompleted.reduce((total, item) => total + (item.rows ?? 0), 0),
      completed_sources: safeCompleted,
      failures: safeFailures,
    };
  }
  const allowedKeys = ["error", "status", "rows", "valid_rows", "quarantined_rows", "duration_ms"];
  return Object.fromEntries(
    allowedKeys
      .filter((key) => Object.hasOwn(parsed, key))
      .map((key) => [key, key === "error" ? safeCode(parsed[key]) : key === "status" ? (SAFE_STATUSES.has(parsed[key]) ? parsed[key] : "unknown_status") : safeNonNegativeInteger(parsed[key])])
      .filter(([, value]) => value !== undefined),
  );
}

export async function runRefresh({ url, slice, secret, timeoutMs = MAX_TIMEOUT_MS, fetchImpl = fetch, now = Date.now }) {
  const parsedUrl = new URL(url);
  if (parsedUrl.protocol !== "https:") throw new Error("refresh URL must use HTTPS");
  const selected = parseSlice(slice);
  const boundedTimeout = Math.min(Math.max(Number(timeoutMs) || MAX_TIMEOUT_MS, 1_000), MAX_TIMEOUT_MS);
  const timestamp = Math.floor(now() / 1_000);
  const body = createPayload(selected);
  const signature = signatureFor({ secret, timestamp, body });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), boundedTimeout);
  try {
    const response = await fetchImpl(parsedUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-raster-timestamp": String(timestamp),
        "x-raster-signature": signature,
      },
      body,
      signal: controller.signal,
    });
    const responseText = await response.text();
    const result = {
      ok: response.ok,
      http_status: response.status,
      slice,
      market: selected.market,
      source_slug: selected.sourceSlug,
      ...safeResponseSummary(responseText),
    };
    if (!response.ok) {
      throw new RefreshResponseError(response.status, result);
    }
    return result;
  } catch (error) {
    if (error instanceof RefreshResponseError) throw error;
    throw new Error("refresh request failed before a safe response was received");
  } finally {
    clearTimeout(timer);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const url = args.url ?? process.env.RASTER_REFRESH_URL;
  const secret = process.env.RASTER_INGEST_HMAC_SECRET;
  if (!url) throw new Error("RASTER_REFRESH_URL or --url is required");
  if (!secret) throw new Error("RASTER_INGEST_HMAC_SECRET is required");
  const result = runRefresh({ url, secret, slice: args.slice ?? "us-central-computer", timeoutMs: args["timeout-ms"] });
  return result.then((summary) => {
    process.stdout.write(`${JSON.stringify(summary)}\n`);
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    if (error instanceof RefreshResponseError) process.stdout.write(`${JSON.stringify(error.summary)}\n`);
    process.stderr.write(`${error instanceof Error ? error.message : "refresh request failed"}\n`);
    process.exitCode = 1;
  });
}
