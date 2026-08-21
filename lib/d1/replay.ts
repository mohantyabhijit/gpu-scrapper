import { eq, lt } from "drizzle-orm";
import * as schema from "../../db/schema.ts";
import type { RasterDatabase } from "./repository.ts";

export type ReplayClaim = {
  acquired: boolean;
  release: () => Promise<void>;
};

export type ReplayGuard = (route: string, timestamp: string, body: string) => Promise<boolean | ReplayClaim>;

export function replayAcquired(claim: boolean | ReplayClaim): boolean {
  return typeof claim === "boolean" ? claim : claim.acquired;
}

export async function releaseReplayClaim(claim: boolean | ReplayClaim | undefined): Promise<void> {
  if (!claim || typeof claim === "boolean" || !claim.acquired) return;
  try {
    await claim.release();
  } catch {
    // Releasing a failed request is best-effort. Never let cleanup hide the
    // sanitized response for the original provider or persistence failure.
  }
}

export async function requestDigest(route: string, timestamp: string, body: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${route}.${timestamp}.${body}`));
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Claim one signed request. Successful calls retain the receipt; failures release it for a safe retry. */
export function createReplayGuard(db: RasterDatabase, now = () => new Date()): ReplayGuard {
  return async (route, timestamp, body) => {
    const createdAt = now();
    const expiresAt = new Date(createdAt.getTime() + 10 * 60 * 1000);
    const key = await requestDigest(route, timestamp, body);
    await db.delete(schema.requestReceipts).where(lt(schema.requestReceipts.expiresAt, createdAt.toISOString())).run();
    const inserted = await db.insert(schema.requestReceipts).values({
      key,
      route,
      createdAt: createdAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
    }).onConflictDoNothing({ target: schema.requestReceipts.key }).returning({ key: schema.requestReceipts.key }).get();
    return {
      acquired: Boolean(inserted),
      release: async () => {
        if (inserted) await db.delete(schema.requestReceipts).where(eq(schema.requestReceipts.key, key)).run();
      },
    };
  };
}
