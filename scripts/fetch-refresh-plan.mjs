import { signatureFor, validateSourceSlug } from "./sign-refresh.mjs";

const MAX_PLAN_SOURCES = 64;
const MAX_RESPONSE_BYTES = 16 * 1024;
const PLAN_TIMEOUT_MS = 30_000;

export function refreshPlanUrl(refreshUrl) {
  const parsed = new URL(refreshUrl);
  if (parsed.protocol !== "https:" || parsed.username || parsed.password || !parsed.pathname.endsWith("/refresh")) {
    throw new Error("refresh URL is invalid");
  }
  parsed.pathname = `${parsed.pathname.slice(0, -"/refresh".length)}/refresh-plan`;
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString();
}

export function validateRefreshPlan(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("refresh plan is invalid");
  const keys = Object.keys(value);
  if (keys.some((key) => key !== "sourceSlugs" && key !== "count") || !Array.isArray(value.sourceSlugs)) {
    throw new Error("refresh plan is invalid");
  }
  if (!Number.isSafeInteger(value.count) || value.count < 1 || value.count > MAX_PLAN_SOURCES || value.sourceSlugs.length !== value.count) {
    throw new Error("refresh plan is invalid");
  }
  let sources;
  try {
    sources = value.sourceSlugs.map(validateSourceSlug);
  } catch {
    throw new Error("refresh plan is invalid");
  }
  const unique = [...new Set(sources)].sort();
  if (unique.length !== value.count) throw new Error("refresh plan is invalid");
  return unique;
}

export async function runRefreshPlan({ refreshUrl, secret, fetchImpl = fetch, now = Date.now, timeoutMs = PLAN_TIMEOUT_MS }) {
  const url = refreshPlanUrl(refreshUrl);
  const body = JSON.stringify({ role: "combined" });
  const timestamp = Math.floor(now() / 1_000);
  const signature = signatureFor({ secret, timestamp, body });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.min(Math.max(timeoutMs, 1_000), PLAN_TIMEOUT_MS));
  try {
    const response = await fetchImpl(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-raster-timestamp": String(timestamp),
        "x-raster-signature": signature,
      },
      body,
      signal: controller.signal,
    });
    const text = await response.text();
    if (!response.ok || text.length > MAX_RESPONSE_BYTES) throw new Error("refresh plan request failed");
    let parsed;
    try { parsed = JSON.parse(text); } catch { throw new Error("refresh plan request failed"); }
    return validateRefreshPlan(parsed);
  } catch (error) {
    if (error instanceof Error && error.message === "refresh plan is invalid") throw error;
    throw new Error("refresh plan request failed");
  } finally {
    clearTimeout(timer);
  }
}

function parseArgs(argv) {
  if (argv.length === 0) return {};
  if (argv.length !== 2 || argv[0] !== "--source-slug") throw new Error("usage: fetch-refresh-plan.mjs [--source-slug <slug>]");
  return { sourceSlug: validateSourceSlug(argv[1]) };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const sources = args.sourceSlug
    ? [args.sourceSlug]
    : await runRefreshPlan({
      refreshUrl: process.env.RASTER_REFRESH_URL,
      secret: process.env.RASTER_INGEST_HMAC_SECRET,
    });
  process.stdout.write(`${JSON.stringify(sources)}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : "refresh plan failed"}\n`);
    process.exitCode = 1;
  });
}
