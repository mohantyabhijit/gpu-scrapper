import { createHmac } from "node:crypto";
import { readFile } from "node:fs/promises";

export function signatureFor({ secret, timestamp, body }) {
  if (typeof secret !== "string" || secret.length < 16) throw new Error("refresh secret is missing or too short");
  return `sha256=${createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex")}`;
}

export function parsePackJson(value) {
  let parsed;
  try { parsed = JSON.parse(value); } catch { throw new Error("market pack JSON is invalid"); }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("market pack JSON must be an object");
  return JSON.stringify(parsed);
}

export async function runMarketPack({ url, packJson, secret, fetchImpl = fetch, now = Date.now }) {
  const endpoint = new URL(url);
  if (endpoint.protocol !== "https:") throw new Error("market pack URL must use HTTPS");
  const body = parsePackJson(packJson);
  const timestamp = Math.floor(now() / 1_000);
  const response = await fetchImpl(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json", "x-raster-timestamp": String(timestamp), "x-raster-signature": signatureFor({ secret, timestamp, body }) },
    body,
  });
  if (!response.ok) throw new Error(`market pack route returned HTTP ${response.status}`);
  const payload = await response.json();
  if (!payload || typeof payload !== "object" || Array.isArray(payload) || typeof payload.slug !== "string" || typeof payload.status !== "string") throw new Error("market pack route returned an invalid safe response");
  return { slug: payload.slug, status: payload.status };
}

function args(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key.startsWith("--") || !value || value.startsWith("--")) throw new Error("expected --url and --file values");
    if (!["url", "file"].includes(key.slice(2))) throw new Error(`unsupported option ${key}`);
    values[key.slice(2)] = value;
    index += 1;
  }
  return values;
}

async function main() {
  const options = args(process.argv.slice(2));
  if (!options.url || !options.file || !process.env.RASTER_INGEST_HMAC_SECRET) throw new Error("--url, --file, and RASTER_INGEST_HMAC_SECRET are required");
  const result = await runMarketPack({ url: options.url, packJson: await readFile(options.file, "utf8"), secret: process.env.RASTER_INGEST_HMAC_SECRET });
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.message : "market pack request failed"}\n`); process.exitCode = 1; });
