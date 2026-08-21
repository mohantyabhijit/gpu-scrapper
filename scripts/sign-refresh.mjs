import { createHmac } from "node:crypto";

export const REFRESH_SLICES = Object.freeze({
  "us-central-computer": Object.freeze({ market: "US", sourceSlug: "central-computer" }),
  "uk-overclockers-uk": Object.freeze({ market: "UK", sourceSlug: "overclockers-uk" }),
  "in-md-computers": Object.freeze({ market: "IN", sourceSlug: "md-computers" }),
  "sg-dynacore": Object.freeze({ market: "SG", sourceSlug: "dynacore" }),
});

export const MAX_TIMEOUT_MS = 120_000;

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
  const listLength = (value) => Array.isArray(value) ? value.length : undefined;
  if (["requested", "completed", "notConfigured", "failed"].some((key) => key in parsed)) {
    return {
      requested: listLength(parsed.requested),
      completed: listLength(parsed.completed),
      not_configured: listLength(parsed.notConfigured),
      failed: listLength(parsed.failed),
    };
  }
  const allowedKeys = ["error", "status", "rows", "valid_rows", "quarantined_rows", "duration_ms"];
  const safeValue = (value) => {
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
    if (typeof value === "string") return value.replace(/[\r\n]+/g, " ").slice(0, 120);
    return undefined;
  };
  return Object.fromEntries(
    allowedKeys
      .filter((key) => Object.hasOwn(parsed, key))
      .map((key) => [key, safeValue(parsed[key])])
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
      throw new Error(`refresh route returned HTTP ${response.status}`);
    }
    return result;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("refresh route returned HTTP")) throw error;
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
    process.stderr.write(`${error instanceof Error ? error.message : "refresh request failed"}\n`);
    process.exitCode = 1;
  });
}
