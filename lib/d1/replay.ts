import * as schema from "../../db/schema.ts";
import type { RasterDatabase } from "./repository.ts";

export type ReplayGuard = (route: string, timestamp: string, body: string) => Promise<boolean>;

export async function requestDigest(route: string, timestamp: string, body: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${route}.${timestamp}.${body}`));
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Atomically consume one signed request. False means the same request ran before. */
export function createReplayGuard(db: RasterDatabase, now = () => new Date()): ReplayGuard {
  return async (route, timestamp, body) => {
    const createdAt = now();
    const expiresAt = new Date(createdAt.getTime() + 10 * 60 * 1000);
    const key = await requestDigest(route, timestamp, body);
    const inserted = await db.insert(schema.requestReceipts).values({
      key,
      route,
      createdAt: createdAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
    }).onConflictDoNothing({ target: schema.requestReceipts.key }).returning({ key: schema.requestReceipts.key }).get();
    return Boolean(inserted);
  };
}
