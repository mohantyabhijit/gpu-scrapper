import { eq, lt } from "drizzle-orm";
import * as schema from "../../db/schema.ts";
import type { RasterDatabase } from "./repository.ts";

export type ReplayClaim = {
  acquired: boolean;
  complete: () => Promise<void>;
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

export async function completeReplayClaim(claim: boolean | ReplayClaim | undefined): Promise<void> {
  if (claim && typeof claim !== "boolean" && claim.acquired) await claim.complete();
}

export async function requestDigest(route: string, timestamp: string, body: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${route}.${timestamp}.${body}`));
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Claim one signed request as a lease, then promote successful work to a durable replay receipt. */
export function createReplayGuard(db: RasterDatabase, now = () => new Date()): ReplayGuard {
  return async (route, timestamp, body) => {
    const createdAt = now();
    // The signer accepts timestamps for five minutes. A four-minute processing
    // lease prevents duplicate concurrent work but can still be reclaimed
    // inside that window if best-effort failure cleanup cannot reach D1.
    const leaseExpiresAt = new Date(createdAt.getTime() + 4 * 60 * 1000);
    const completedExpiresAt = new Date(createdAt.getTime() + 10 * 60 * 1000);
    const key = await requestDigest(route, timestamp, body);
    await db.delete(schema.requestReceipts).where(lt(schema.requestReceipts.expiresAt, createdAt.toISOString())).run();
    const inserted = await db.insert(schema.requestReceipts).values({
      key,
      route,
      createdAt: createdAt.toISOString(),
      expiresAt: leaseExpiresAt.toISOString(),
    }).onConflictDoNothing({ target: schema.requestReceipts.key }).returning({ key: schema.requestReceipts.key }).get();
    return {
      acquired: Boolean(inserted),
      complete: async () => {
        if (inserted) {
          await db.update(schema.requestReceipts)
            .set({ expiresAt: completedExpiresAt.toISOString() })
            .where(eq(schema.requestReceipts.key, key))
            .run();
        }
      },
      release: async () => {
        if (inserted) await db.delete(schema.requestReceipts).where(eq(schema.requestReceipts.key, key)).run();
      },
    };
  };
}
