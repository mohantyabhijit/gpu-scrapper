import { createHmac } from "node:crypto";

export function signatureFor({ secret, timestamp, body }) {
  return `sha256=${createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex")}`;
}

export async function runHealEvent({ url, eventJson, secret, fetchImpl = fetch, now = Date.now }) {
  const timestamp = Math.floor(now() / 1000);
  const response = await fetchImpl(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-raster-timestamp": String(timestamp),
      "x-raster-signature": signatureFor({ secret, timestamp, body: eventJson }),
    },
    body: eventJson,
  });
  let payload = {};
  try { payload = await response.json(); } catch { /* safe fallback below */ }
  if (!response.ok) throw new Error(`Heal evidence request failed (${response.status}): ${String(payload.error ?? "unknown_error")}`);
  return {
    sessionId: String(payload.sessionId ?? ""),
    stage: String(payload.stage ?? ""),
    nextStage: payload.nextStage ? String(payload.nextStage) : undefined,
    complete: Boolean(payload.complete),
  };
}

async function main() {
  const [url, eventPath] = process.argv.slice(2);
  const secret = process.env.RASTER_INGEST_HMAC_SECRET;
  if (!url || !eventPath || !secret) {
    throw new Error("Usage: RASTER_INGEST_HMAC_SECRET=<secret> node scripts/sign-heal-event.mjs <url> <event.json>");
  }
  const { readFile } = await import("node:fs/promises");
  const eventJson = await readFile(eventPath, "utf8");
  const result = await runHealEvent({ url, eventJson, secret });
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : "Heal evidence request failed"}\n`);
    process.exitCode = 1;
  });
}
