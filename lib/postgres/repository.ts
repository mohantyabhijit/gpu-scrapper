import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import * as schema from "../../db/schema.ts";
import { getSource, isKnownSource, type CollectorId, type CollectorRole, type SourceDefinition, type SourceRole, type SourceSlug } from "../../config/sources.ts";
import { MAX_RESPONSE_ID_LENGTH } from "../brightdata/client.ts";
import type { IngestionResult } from "../ingest.ts";
import type { RefreshFailureCode, RefreshFailureInput } from "../brightdata/refresh.ts";

export type RasterDatabase = PostgresJsDatabase<typeof schema>;
type RasterStatement = PromiseLike<unknown>;

export type PersistenceContext = {
  runId: string;
  sourceSlug: SourceSlug;
  /** Provider identity for successful runs; absent only for legacy callers. */
  collectorId?: string;
  responseId?: string;
  source?: SourceDefinition;
  startedAt: string;
  finishedAt?: string;
  observedAt: string;
  status?: "healthy" | "degraded" | "empty";
};

export type PersistenceResult = {
  runId: string;
  productsUpserted: number;
  offersUpserted: number;
  observationsAttempted: number;
  quarantinedAttempted: number;
  status: "healthy" | "degraded" | "empty";
};

export type SourceFailurePersistenceInput = Pick<RefreshFailureInput, "source" | "sourceSlug" | "collectorId" | "responseId" | "code" | "failedAt">;

export type SourceFailurePersistenceResult = {
  runId: string;
  status: "degraded";
};

function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string") return (value as T) ?? fallback;
  try { return JSON.parse(value) as T; } catch { return fallback; }
}

/** Resolve operator-owned PostgreSQL source metadata; static registry remains the fallback. */
export function createPostgresSourceResolver(db: RasterDatabase) {
  return async (slug: string): Promise<SourceDefinition | undefined> => {
    const staticSource = isKnownSource(slug) ? getSource(slug) : undefined;
    const [row] = await db.select().from(schema.sources).where(eq(schema.sources.slug, slug)).limit(1);
    if (!row) return staticSource;
    if (row.onboardingStatus !== "ready") return undefined;
    const allowedHosts = parseJson<readonly string[]>(row.allowedHosts, staticSource?.allowedHosts ?? []);
    const collectorIds = parseJson<Partial<Record<CollectorRole, CollectorId>>>(row.collectorIds, staticSource?.collectorIds ?? {});
    const source: SourceDefinition = {
      slug,
      displayName: row.displayName || staticSource?.displayName || slug,
      role: (row.role || staticSource?.role || "secondary") as SourceRole,
      region: (row.region || row.market || staticSource?.region || "") as SourceDefinition["region"],
      currency: (row.currency || staticSource?.currency || "") as SourceDefinition["currency"],
      baseUrl: row.baseUrl || staticSource?.baseUrl || "",
      allowedHosts,
      catalogUrl: row.catalogUrl || staticSource?.catalogUrl || "",
      enabled: row.enabled,
      collectorIds,
      collectorRoles: Object.keys(collectorIds) as CollectorRole[],
    };
    if (!source.enabled || !source.catalogUrl || source.allowedHosts.length === 0 || Object.keys(source.collectorIds).length === 0) return undefined;
    return source;
  };
}

function statusFor(result: IngestionResult, requested?: PersistenceContext["status"]): PersistenceResult["status"] {
  // A caller may downgrade an otherwise healthy run (for example, when a
  // provider reports a bounded warning), but cannot make invalid output look
  // healthy or make a non-empty batch look empty.
  if (requested === "degraded") return requested;
  if (result.offers.length > 0 && result.quarantined.length === 0) return "healthy";
  if (result.offers.length > 0) return "degraded";
  return result.quarantined.length > 0 ? "degraded" : "empty";
}

function validationSummary(result: IngestionResult): string {
  const codes = new Map<string, number>();
  for (const row of result.quarantined) {
    for (const code of row.reasonCodes) codes.set(code, (codes.get(code) ?? 0) + 1);
  }
  return JSON.stringify(Object.fromEntries(codes));
}

const safeFailureCodes = new Set<RefreshFailureCode>([
  "not_configured",
  "invalid_response",
  "provider_error",
  "timeout",
  "persistence_error",
]);

function safeFailureCode(code: unknown): RefreshFailureCode {
  return typeof code === "string" && safeFailureCodes.has(code as RefreshFailureCode)
    ? code as RefreshFailureCode
    : "provider_error";
}

/** Bounded deterministic identity for one persisted provider failure. */
async function failureRunId(input: SourceFailurePersistenceInput, code: RefreshFailureCode): Promise<string> {
  // Trigger failures with a known response collapse by provider response;
  // pre-trigger failures collapse by source, collector, and safe error code.
  // This intentionally keeps one degraded evidence row for repeated retries.
  const identity = input.responseId
    ? `response\u0000${input.sourceSlug}\u0000${input.collectorId}\u0000${input.responseId}`
    : `failure\u0000${input.sourceSlug}\u0000${input.collectorId}\u0000${code}`;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(identity));
  const hash = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  const source = input.sourceSlug.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 64) || "source";
  return `failure-${source}-${hash}`;
}

function assertCollectorBelongsToSource(source: SourceDefinition, collectorId: string | undefined): void {
  if (collectorId === undefined) return;
  if (!/^c_[A-Za-z0-9_-]{2,127}$/.test(collectorId)) throw new Error("collectorId is invalid");
  const registered = Object.values(source.collectorIds).filter((id): id is CollectorId => typeof id === "string");
  if (!registered.includes(collectorId as CollectorId)) {
    throw new Error("collectorId does not match source");
  }
}

function assertBatchBelongsToSource(result: IngestionResult, context: PersistenceContext): void {
  for (const offer of result.offers) {
    if (offer.sourceSlug !== context.sourceSlug) {
      throw new Error("ingestion batch contains offers from multiple sources");
    }
  }
}

function sourceUpsert(db: RasterDatabase, source: SourceDefinition): RasterStatement {
  const timestamp = new Date().toISOString();
  const sourceValues = {
    displayName: source.displayName,
    market: source.region,
    region: source.region,
    currency: source.currency,
    baseUrl: source.baseUrl,
    role: source.role,
    allowedHosts: JSON.stringify(source.allowedHosts),
    catalogUrl: source.catalogUrl,
    collectorIds: JSON.stringify(source.collectorIds),
    onboardingStatus: source.enabled ? "ready" : "pending",
    enabled: source.enabled,
    updatedAt: timestamp,
  };
  return db.insert(schema.sources).values({
    slug: source.slug,
    ...sourceValues,
  }).onConflictDoUpdate({
    target: schema.sources.slug,
    set: sourceValues,
  });
}

function productUpserts(db: RasterDatabase, result: IngestionResult, observedAt: string): RasterStatement[] {
  const statements: RasterStatement[] = [];
  for (const product of result.products) {
    statements.push(db.insert(schema.products).values({
      identityKey: product.identityKey,
      slug: product.slug,
      gpuFamily: product.gpuFamily,
      model: product.model,
      boardPartner: product.boardPartner,
      vramGb: product.vramGb,
      mpn: product.mpn,
      searchText: product.searchText,
      updatedAt: observedAt,
    }).onConflictDoUpdate({
      target: schema.products.identityKey,
      set: {
        slug: product.slug,
        gpuFamily: product.gpuFamily,
        model: product.model,
        boardPartner: product.boardPartner,
        vramGb: product.vramGb,
        mpn: product.mpn,
        searchText: product.searchText,
        updatedAt: observedAt,
      },
    }));
  }
  return statements;
}

function offerAndObservationUpserts(
  db: RasterDatabase,
  result: IngestionResult,
  runId: string,
): RasterStatement[] {
  const statements: RasterStatement[] = [];
  for (const offer of result.offers) {
    statements.push(db.insert(schema.offers).values({
      offerKey: offer.offerKey,
      productIdentityKey: offer.product.identityKey,
      sourceSlug: offer.sourceSlug,
      market: offer.market,
      sourceSku: offer.sourceSku,
      title: offer.title,
      productUrl: offer.productUrl,
      imageUrl: offer.imageUrl,
      priceMinor: offer.priceMinor,
      currency: offer.currency,
      availability: offer.availability,
      observedAt: offer.observedAt,
      health: "healthy",
      updatedAt: offer.observedAt,
    }).onConflictDoUpdate({
      target: schema.offers.offerKey,
      set: {
        productIdentityKey: offer.product.identityKey,
        sourceSlug: offer.sourceSlug,
        market: offer.market,
        sourceSku: offer.sourceSku,
        title: offer.title,
        productUrl: offer.productUrl,
        imageUrl: offer.imageUrl,
        priceMinor: offer.priceMinor,
        currency: offer.currency,
        availability: offer.availability,
        observedAt: offer.observedAt,
        health: "healthy",
        updatedAt: offer.observedAt,
      },
    }));
  }
  for (const observation of result.observations) {
    statements.push(db.insert(schema.priceObservations).values({
      observationKey: observation.observationKey,
      offerKey: observation.offerKey,
      runId,
      market: observation.market,
      priceMinor: observation.priceMinor,
      currency: observation.currency,
      availability: observation.availability,
      observedAt: observation.observedAt,
      rowFingerprint: observation.rowFingerprint,
    }).onConflictDoNothing({ target: schema.priceObservations.observationKey }));
  }
  return statements;
}

function runAndQuarantineUpserts(
  db: RasterDatabase,
  result: IngestionResult,
  context: PersistenceContext,
  status: PersistenceResult["status"],
): RasterStatement[] {
  const source = context.source ?? getSource(context.sourceSlug);
  assertCollectorBelongsToSource(source, context.collectorId);
  const statements: RasterStatement[] = [db.insert(schema.collectorRuns).values({
    runId: context.runId,
    sourceSlug: context.sourceSlug,
    collectorId: context.collectorId,
    responseId: context.responseId,
    market: source.region,
    currency: source.currency,
    status,
    acceptedCount: result.summary.accepted,
    rejectedCount: result.summary.rejected,
    startedAt: context.startedAt,
    finishedAt: context.finishedAt ?? context.observedAt,
    validationSummary: validationSummary(result),
  }).onConflictDoUpdate({
    target: schema.collectorRuns.runId,
    set: {
      status,
      acceptedCount: result.summary.accepted,
      rejectedCount: result.summary.rejected,
      finishedAt: context.finishedAt ?? context.observedAt,
      collectorId: context.collectorId,
      responseId: context.responseId,
      validationSummary: validationSummary(result),
    },
  })];

  for (const row of result.quarantined) {
    statements.push(db.insert(schema.quarantinedRows).values({
      runId: row.runId,
      sourceSlug: row.sourceSlug,
      rowIndex: row.rowIndex,
      reasonCodes: JSON.stringify(row.reasonCodes),
      rowFingerprint: row.rowFingerprint,
    }).onConflictDoNothing({
      target: [schema.quarantinedRows.runId, schema.quarantinedRows.rowFingerprint],
    }));
  }
  return statements;
}

function degradedOfferUpdate(
  db: RasterDatabase,
  sourceSlug: SourceSlug,
): RasterStatement {
  return db.update(schema.offers)
    // Keep every last-known-good value, including its observation and update
    // timestamps; only source health changes after a provider failure.
    .set({ health: "degraded" })
    .where(eq(schema.offers.sourceSlug, sourceSlug));
}

function buildPersistenceStatements(
  db: RasterDatabase,
  result: IngestionResult,
  context: PersistenceContext,
  status: PersistenceResult["status"],
): RasterStatement[] {
  const source = context.source ?? getSource(context.sourceSlug);
  const statements: RasterStatement[] = [sourceUpsert(db, source)];
  if (status === "degraded") {
    // Degrade the previous snapshot first; accepted rows in this run are then
    // restored to healthy by their upserts below.
    statements.push(degradedOfferUpdate(db, context.sourceSlug));
  }
  statements.push(...productUpserts(db, result, context.observedAt));
  statements.push(...offerAndObservationUpserts(db, result, context.runId));
  statements.push(...runAndQuarantineUpserts(db, result, { ...context, source }, status));
  return statements;
}

/**
 * Persist a provider/client failure without replacing the source's last
 * successful offer snapshot. The failure run identity is deterministic for
 * the sanitized failure input, making retries an idempotent upsert.
 */
export async function persistSourceFailure(
  db: RasterDatabase,
  input: SourceFailurePersistenceInput,
): Promise<SourceFailurePersistenceResult> {
  if (!input.sourceSlug.trim()) throw new Error("sourceSlug is required");
  if (!input.collectorId.trim()) throw new Error("collectorId is required");
  if (input.responseId !== undefined && (!input.responseId.trim() || input.responseId.length > MAX_RESPONSE_ID_LENGTH)) {
    throw new Error("responseId is invalid");
  }
  if (!input.failedAt.trim()) throw new Error("failedAt is required");
  if (input.source.slug !== input.sourceSlug) throw new Error("source metadata does not match sourceSlug");
  const code = safeFailureCode(input.code);
  assertCollectorBelongsToSource(input.source, input.collectorId);
  const runId = await failureRunId(input, code);
  const summary = JSON.stringify({ failureCode: code });
  await db.transaction(async (tx) => {
    await sourceUpsert(tx as RasterDatabase, input.source);
    await degradedOfferUpdate(tx as RasterDatabase, input.sourceSlug);
    await tx.insert(schema.collectorRuns).values({
      runId,
      sourceSlug: input.sourceSlug,
      collectorId: input.collectorId,
      responseId: input.responseId ?? null,
      market: input.source.region,
      currency: input.source.currency,
      status: "degraded",
      acceptedCount: 0,
      rejectedCount: 0,
      startedAt: input.failedAt,
      finishedAt: input.failedAt,
      validationSummary: summary,
    }).onConflictDoUpdate({
      target: schema.collectorRuns.runId,
      set: {
        status: "degraded",
        acceptedCount: 0,
        rejectedCount: 0,
        finishedAt: input.failedAt,
        collectorId: input.collectorId,
        responseId: input.responseId ?? null,
        validationSummary: summary,
      },
    });
  });
  return { runId, status: "degraded" };
}

/** Persist the complete normalized run in one hosted PostgreSQL transaction. */
export async function persistIngestion(
  db: RasterDatabase,
  result: IngestionResult,
  context: PersistenceContext,
): Promise<PersistenceResult> {
  if (!context.runId.trim()) throw new Error("runId is required");
  assertBatchBelongsToSource(result, context);
  const status = statusFor(result, context.status);
  await db.transaction(async (tx) => {
    for (const statement of buildPersistenceStatements(tx as RasterDatabase, result, context, status)) {
      await statement;
    }
  });
  return {
    runId: context.runId,
    productsUpserted: result.products.length,
    offersUpserted: result.offers.length,
    observationsAttempted: result.observations.length,
    quarantinedAttempted: result.quarantined.length,
    status,
  };
}
