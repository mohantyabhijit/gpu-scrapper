import { normalizeOffer, type NormalizedOffer, type NormalizedProduct } from "./normalize/index.ts";
import { validateRawOffer, type RawOffer, type ValidationCode } from "../scrapers/contracts.ts";
import type { SourceDefinition } from "../config/sources.ts";

export type IngestionContext = {
  runId: string;
  observedAt: string;
  expectedSource?: string;
  source?: SourceDefinition;
};

export type QuarantinedRow = {
  runId: string;
  sourceSlug?: string;
  rowIndex: number;
  reasonCodes: ValidationCode[] | ["normalization_error"];
  rowFingerprint: string;
};

export type IngestionResult = {
  products: NormalizedProduct[];
  offers: NormalizedOffer[];
  observations: Array<NormalizedOffer & { observationKey: string; rowFingerprint: string }>;
  quarantined: QuarantinedRow[];
  summary: { accepted: number; rejected: number; duplicate: number };
};

/** Stable, non-cryptographic fingerprint suitable for idempotency keys. */
export function fingerprintRow(row: unknown): string {
  const input = JSON.stringify(row, Object.keys((row && typeof row === "object" && !Array.isArray(row)) ? row : {}).sort()) ?? String(row);
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function ingestRows(rows: readonly RawOffer[], context: IngestionContext): IngestionResult {
  if (!context.runId.trim()) throw new Error("runId is required");
  if (!/^\d{4}-\d{2}-\d{2}T/.test(context.observedAt)) throw new Error("observedAt must be an ISO timestamp");
  const offers: NormalizedOffer[] = [];
  const products = new Map<string, NormalizedProduct>();
  const observations: IngestionResult["observations"] = [];
  const quarantined: QuarantinedRow[] = [];
  const seenOffers = new Set<string>();
  const seenObservations = new Set<string>();

  rows.forEach((row, rowIndex) => {
    const fingerprint = fingerprintRow(row);
    const validation = validateRawOffer(row, context.expectedSource, context.source);
    if (!validation.ok) {
      quarantined.push({
        runId: context.runId,
        sourceSlug: typeof row?.source_slug === "string" ? row.source_slug : context.expectedSource,
        rowIndex,
        reasonCodes: validation.errors,
        rowFingerprint: fingerprint,
      });
      return;
    }
    try {
      const offer = normalizeOffer(validation.value, context.observedAt);
      if (seenOffers.has(offer.offerKey)) return;
      const observationKey = `${context.runId}:${offer.offerKey}`;
      if (seenObservations.has(observationKey)) return;
      seenOffers.add(offer.offerKey);
      seenObservations.add(observationKey);
      offers.push(offer);
      products.set(offer.product.identityKey, offer.product);
      observations.push({ ...offer, observationKey, rowFingerprint: fingerprint });
    } catch {
      quarantined.push({
        runId: context.runId,
        sourceSlug: validation.value.sourceSlug,
        rowIndex,
        reasonCodes: ["normalization_error"],
        rowFingerprint: fingerprint,
      });
    }
  });

  return {
    products: [...products.values()],
    offers,
    observations,
    quarantined,
    summary: {
      accepted: offers.length,
      rejected: quarantined.length,
      duplicate: rows.length - offers.length - quarantined.length,
    },
  };
}
