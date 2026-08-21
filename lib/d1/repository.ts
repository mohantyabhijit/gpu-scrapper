import type { DrizzleD1Database } from "drizzle-orm/d1";
import type { BatchItem } from "drizzle-orm/batch";
import { eq } from "drizzle-orm";
import * as schema from "../../db/schema.ts";
import { getSource, type SourceSlug } from "../../config/sources.ts";
import type { IngestionResult } from "../ingest.ts";

export type RasterDatabase = DrizzleD1Database<typeof schema>;
type RasterBatchItem = BatchItem<"sqlite">;

export type PersistenceContext = {
  runId: string;
  sourceSlug: SourceSlug;
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

function assertBatchBelongsToSource(result: IngestionResult, context: PersistenceContext): void {
  for (const offer of result.offers) {
    if (offer.sourceSlug !== context.sourceSlug) {
      throw new Error("ingestion batch contains offers from multiple sources");
    }
  }
}

function sourceUpsert(db: RasterDatabase, sourceSlug: SourceSlug): RasterBatchItem {
  const source = getSource(sourceSlug);
  return db.insert(schema.sources).values({
    slug: source.slug,
    displayName: source.displayName,
    market: source.region,
    region: source.region,
    currency: source.currency,
    baseUrl: source.baseUrl,
    enabled: source.enabled,
  }).onConflictDoUpdate({
    target: schema.sources.slug,
    set: {
      displayName: source.displayName,
      market: source.region,
      region: source.region,
      currency: source.currency,
      baseUrl: source.baseUrl,
      enabled: source.enabled,
    },
  });
}

function productUpserts(db: RasterDatabase, result: IngestionResult, observedAt: string): RasterBatchItem[] {
  const statements: RasterBatchItem[] = [];
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
): RasterBatchItem[] {
  const statements: RasterBatchItem[] = [];
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
): RasterBatchItem[] {
  const source = getSource(context.sourceSlug);
  const statements: RasterBatchItem[] = [db.insert(schema.collectorRuns).values({
    runId: context.runId,
    sourceSlug: context.sourceSlug,
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
  observedAt: string,
): RasterBatchItem {
  return db.update(schema.offers)
    .set({ health: "degraded", updatedAt: observedAt })
    .where(eq(schema.offers.sourceSlug, sourceSlug));
}

function buildPersistenceBatch(
  db: RasterDatabase,
  result: IngestionResult,
  context: PersistenceContext,
  status: PersistenceResult["status"],
): [RasterBatchItem, ...RasterBatchItem[]] {
  const statements: RasterBatchItem[] = [sourceUpsert(db, context.sourceSlug)];
  statements.push(...productUpserts(db, result, context.observedAt));
  statements.push(...offerAndObservationUpserts(db, result, context.runId));
  if (status === "degraded") {
    statements.push(degradedOfferUpdate(db, context.sourceSlug, context.observedAt));
  }
  statements.push(...runAndQuarantineUpserts(db, result, context, status));
  return statements as [RasterBatchItem, ...RasterBatchItem[]];
}

/*
 * D1's batch API is the atomic write boundary. Do not replace this with
 * db.transaction: D1 auto-commits individual statements and does not provide
 * the production atomicity guarantees needed for a multi-table ingest.
 */
export async function persistIngestion(
  db: RasterDatabase,
  result: IngestionResult,
  context: PersistenceContext,
): Promise<PersistenceResult> {
  if (!context.runId.trim()) throw new Error("runId is required");
  assertBatchBelongsToSource(result, context);
  const status = statusFor(result, context.status);
  await db.batch(buildPersistenceBatch(db, result, context, status));
  return {
    runId: context.runId,
    productsUpserted: result.products.length,
    offersUpserted: result.offers.length,
    observationsAttempted: result.observations.length,
    quarantinedAttempted: result.quarantined.length,
    status,
  };
}
