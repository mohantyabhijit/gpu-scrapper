import { extractCollectorRows, type CollectorField } from "../contracts.ts";

type InfinityProviderRow = Record<string, unknown>;

export type InfinityCapture = {
  payload: { rows: Record<CollectorField, unknown>[] };
  evidence: {
    collector_id?: string;
    target_url: string;
    catalog_url: string;
    source_slug: string;
    market: string;
    currency: string;
    manifest_name: string;
    scraper_name: string;
    adapter_result: "passed";
    validator_result: "pending" | "passed" | "failed";
    source_card_count: number;
    gpu_card_count: number;
    adapted_row_count: number;
    accepted_row_count: number;
    quarantined_row_count: number;
    excluded_category_count: number;
    price_required_count: number;
    validated_offer_count: number;
    canonical_model_count: number;
    cross_retailer_match_count: number;
    status: "completed";
    row_count: number;
    valid_rows: number;
    quarantined_rows: number;
    rows: Record<CollectorField, unknown>[];
  };
  /** Original provider index for every compacted adapted row. */
  rowIndexes: number[];
  rejected: Array<{
    rowIndex: number;
    reason: "non_gpu_category" | "price_required" | "malformed_row";
    sourceSlug?: string;
    rowFingerprint: string;
  }>;
};

const TARGET_URL = "https://infinitycomputer.com.sg/prices";
const SOURCE_SLUG = "infinity-computer";

export type InfinityBreadth = {
  validated_offer_count: number;
  canonical_model_count: number;
  cross_retailer_match_count: number;
};

function text(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const result = String(value).trim();
  return result || null;
}

function nullableText(value: unknown): string | null {
  return text(value);
}

function availability(value: unknown): "in_stock" | "out_of_stock" | "preorder" | "unknown" {
  const normalized = text(value)?.toLowerCase().replace(/[ -]+/g, "_");
  if (!normalized) return "unknown";
  if (["in_stock", "instock", "available", "yes", "true"].includes(normalized)) return "in_stock";
  if (["out_of_stock", "outofstock", "unavailable", "sold_out", "no", "false"].includes(normalized)) return "out_of_stock";
  if (["preorder", "pre_order", "backorder", "back_order"].includes(normalized)) return "preorder";
  return "unknown";
}

function numericSgdPrice(value: unknown): number | null {
  const candidate = value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>).value
    : value;
  if (typeof candidate === "number") return Number.isFinite(candidate) && candidate > 0 ? candidate : null;
  if (typeof candidate !== "string") return null;
  const cleaned = candidate.replace(/[^0-9.,-]/g, "").replace(/,/g, "").trim();
  if (!cleaned || !Number.isFinite(Number(cleaned)) || Number(cleaned) <= 0) return null;
  return Number(cleaned);
}

function canonicalModelKey(row: Record<string, unknown>): string | null {
  const identity = text(row.mpn) ?? text(row.sku) ?? text(row.raw_model) ?? text(row.title);
  if (!identity) return null;
  return identity.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 160) || null;
}

/** Compute breadth only from rows already accepted by the shared validator. */
export function computeInfinityBreadth(
  validatedRows: readonly Record<string, unknown>[],
  comparisonRows: readonly Record<string, unknown>[] = [],
): InfinityBreadth {
  const modelKeys = new Set(validatedRows.map(canonicalModelKey).filter((value): value is string => Boolean(value)));
  const comparisonKeys = new Set(comparisonRows.map(canonicalModelKey).filter((value): value is string => Boolean(value)));
  return {
    validated_offer_count: validatedRows.length,
    canonical_model_count: modelKeys.size,
    cross_retailer_match_count: [...modelKeys].filter((key) => comparisonKeys.has(key)).length,
  };
}

export function fingerprintInfinityRow(row: unknown): string {
  const input = JSON.stringify(row, Object.keys((row && typeof row === "object" && !Array.isArray(row)) ? row : {}).sort()) ?? String(row);
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function normalizeRow(row: InfinityProviderRow, price: number): Record<CollectorField, unknown> {
  const priceObject = row.price_sgd && typeof row.price_sgd === "object" && !Array.isArray(row.price_sgd)
    ? row.price_sgd as Record<string, unknown>
    : {};
  return {
    // Preserve provider identity. A missing or mismatched source remains
    // visible to the shared validator and is never silently repaired.
    source_slug: text(row.source_slug),
    market: text(row.market),
    title: text(row.title),
    product_url: text(row.canonical_product_url) ?? text(row.product_page_url),
    price,
    currency: text(row.currency) ?? text(priceObject.currency),
    availability: availability(row.availability),
    sku: nullableText(row.sku),
    mpn: nullableText(row.mpn),
    manufacturer: nullableText(row.manufacturer),
    board_partner: nullableText(row.board_partner),
    raw_model: nullableText(row.raw_model),
    image_url: nullableText(row.image_url),
    scraped_at: text(row.scraped_at),
  };
}

export function adaptInfinityOutput(
  input: unknown,
  options: { collectorId?: string; validatorResult?: "pending" | "passed" | "failed"; acceptedRowCount?: number; breadth?: InfinityBreadth } = {},
): InfinityCapture {
  const extracted = extractCollectorRows(input);
  if (!extracted.ok) throw new Error(`Infinity Computer provider output is ${extracted.code}`);

  const rejected: InfinityCapture["rejected"] = [];
  const rows: Record<CollectorField, unknown>[] = [];
  const rowIndexes: number[] = [];
  let gpuCardCount = 0;
  let excludedCategoryCount = 0;
  let priceRequiredCount = 0;

  extracted.rows.forEach((candidate, rowIndex) => {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
      rejected.push({ rowIndex, reason: "malformed_row", rowFingerprint: fingerprintInfinityRow(candidate) });
      return;
    }
    const row = candidate as InfinityProviderRow;
    if (row.category !== "GPU") {
      excludedCategoryCount += 1;
      rejected.push({ rowIndex, reason: "non_gpu_category", sourceSlug: text(row.source_slug) ?? undefined, rowFingerprint: fingerprintInfinityRow(row) });
      return;
    }
    gpuCardCount += 1;
    const price = numericSgdPrice(row.price_sgd);
    if (price === null) {
      priceRequiredCount += 1;
      rejected.push({ rowIndex, reason: "price_required", sourceSlug: text(row.source_slug) ?? undefined, rowFingerprint: fingerprintInfinityRow(row) });
      return;
    }
    rows.push(normalizeRow(row, price));
    rowIndexes.push(rowIndex);
  });

  return {
    payload: { rows },
    evidence: {
      ...(options.collectorId ? { collector_id: options.collectorId } : {}),
      target_url: TARGET_URL,
      catalog_url: TARGET_URL,
      source_slug: SOURCE_SLUG,
      market: "SG",
      currency: "SGD",
      manifest_name: "scrapers/manifests/infinity-computer.json",
      scraper_name: "raster-sg-infinity-computer-gpus",
      adapter_result: "passed",
      validator_result: options.validatorResult ?? "pending",
      source_card_count: extracted.rows.length,
      gpu_card_count: gpuCardCount,
      adapted_row_count: rows.length,
      accepted_row_count: options.acceptedRowCount ?? 0,
      quarantined_row_count: rejected.length,
      excluded_category_count: excludedCategoryCount,
      price_required_count: priceRequiredCount,
      validated_offer_count: options.breadth?.validated_offer_count ?? options.acceptedRowCount ?? 0,
      canonical_model_count: options.breadth?.canonical_model_count ?? 0,
      cross_retailer_match_count: options.breadth?.cross_retailer_match_count ?? 0,
      status: "completed",
      row_count: rows.length,
      valid_rows: options.acceptedRowCount ?? 0,
      quarantined_rows: rejected.length,
      rows,
    },
    rowIndexes,
    rejected,
  };
}
