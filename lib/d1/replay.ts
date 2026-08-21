import { and, eq, lt } from "drizzle-orm";
import * as schema from "../../db/schema.ts";
import type { RasterDatabase } from "./repository.ts";
import { MAX_PROVIDER_RUN_MS } from "../brightdata/client.ts";

export type ReplayClaim = {
  acquired: boolean;
  complete: () => Promise<void>;
  release: () => Promise<void>;
};

export type ReplayGuard = (route: string, timestamp: string, body: string) => Promise<boolean | ReplayClaim>;

export type RateClaim = {
  acquired: boolean;
  retryAfterSeconds: number;
  complete: () => Promise<void>;
};

export type SourceRateGuard = (sourceSlug: string) => Promise<RateClaim>;

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
    // Refresh requests contain one source. Its client-side trigger/poll bound
    // is 6m15s; keep the claim for one extra minute for validation and D1.
    // The HMAC itself expires sooner, so an identical signed request cannot
    // reclaim this lease while the bounded owner may still be running.
    const leaseExpiresAt = new Date(createdAt.getTime() + MAX_PROVIDER_RUN_MS + 60_000);
    const completedExpiresAt = new Date(createdAt.getTime() + 10 * 60 * 1000);
    const ownerToken = createdAt.toISOString();
    const key = await requestDigest(route, timestamp, body);
    await db.delete(schema.requestReceipts).where(lt(schema.requestReceipts.expiresAt, createdAt.toISOString())).run();
    const inserted = await db.insert(schema.requestReceipts).values({
      key,
      route,
      createdAt: ownerToken,
      expiresAt: leaseExpiresAt.toISOString(),
    }).onConflictDoNothing({ target: schema.requestReceipts.key }).returning({ key: schema.requestReceipts.key }).get();
    return {
      acquired: Boolean(inserted),
      complete: async () => {
        if (inserted) {
          await db.update(schema.requestReceipts)
            .set({ expiresAt: completedExpiresAt.toISOString() })
            .where(and(
              eq(schema.requestReceipts.key, key),
              eq(schema.requestReceipts.createdAt, ownerToken),
            ))
            .run();
        }
      },
      release: async () => {
        if (inserted) {
          await db.delete(schema.requestReceipts).where(and(
            eq(schema.requestReceipts.key, key),
            eq(schema.requestReceipts.createdAt, ownerToken),
          )).run();
        }
      },
    };
  };
}

/** Atomically allow one provider run per source, then hold a short cooldown. */
export function createSourceRateGuard(
  db: RasterDatabase,
  now = () => new Date(),
  cooldownMs = 60_000,
): SourceRateGuard {
  return async (sourceSlug) => {
    const createdAt = now();
    const ownerToken = createdAt.toISOString();
    const key = await requestDigest("refresh-rate", "0", sourceSlug);
    const leaseExpiresAt = new Date(createdAt.getTime() + MAX_PROVIDER_RUN_MS + 60_000);
    await db.delete(schema.requestReceipts).where(lt(schema.requestReceipts.expiresAt, createdAt.toISOString())).run();
    const inserted = await db.insert(schema.requestReceipts).values({
      key,
      route: "refresh-rate",
      createdAt: ownerToken,
      expiresAt: leaseExpiresAt.toISOString(),
    }).onConflictDoNothing({ target: schema.requestReceipts.key }).returning({ key: schema.requestReceipts.key }).get();
    const existing = inserted ? undefined : await db.select({ expiresAt: schema.requestReceipts.expiresAt })
      .from(schema.requestReceipts)
      .where(eq(schema.requestReceipts.key, key))
      .get();
    const retryAfterSeconds = existing
      ? Math.max(1, Math.ceil((new Date(existing.expiresAt).getTime() - createdAt.getTime()) / 1_000))
      : 0;
    return {
      acquired: Boolean(inserted),
      retryAfterSeconds,
      complete: async () => {
        if (!inserted) return;
        const cooldownExpiresAt = new Date(now().getTime() + cooldownMs).toISOString();
        await db.update(schema.requestReceipts)
          .set({ expiresAt: cooldownExpiresAt })
          .where(and(
            eq(schema.requestReceipts.key, key),
            eq(schema.requestReceipts.createdAt, ownerToken),
          ))
          .run();
      },
    };
  };
}
