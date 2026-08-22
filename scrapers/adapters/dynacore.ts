import { extractCollectorRows, type CollectorField } from "../contracts.ts";

/**
 * Bright Data's generated Dynacore collector returns a price object, omits
 * availability on some cards, and includes provider-only input metadata.
 * Convert that bounded provider shape into Raster's explicit row contract
 * without relaxing the shared validator or retaining provider fields.
 */

type DynacoreProviderRow = Record<string, unknown>;

export type DynacoreCapture = {
  /** Exact provider-row wrapper accepted by the shared collector validator. */
  payload: { rows: Record<CollectorField, unknown>[] };
  /** Safe evidence envelope; it is never sent to the ingestion validator. */
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
    adapted_row_count: number;
    accepted_row_count: number;
    quarantined_row_count: number;
    rejected_accessory_count: number;
    status: "completed";
    row_count: number;
    valid_rows: number;
    quarantined_rows: number;
    rows: Record<CollectorField, unknown>[];
  };
  /** Original provider index for each compacted adapted row. */
  rowIndexes: number[];
  rejected: Array<{
    rowIndex: number;
    reason: "non_gpu_accessory" | "malformed_row";
    sourceSlug?: string;
    rowFingerprint: string;
  }>;
};

const ACCESSORY_TITLE_PATTERN = /\b(?:holder|bracket|support|stand|anti[- ]?sag)\b/i;

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

function providerPrice(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  return (value as Record<string, unknown>).value;
}

/** Stable, non-cryptographic fingerprint for quarantined provider rows. */
export function fingerprintDynacoreRow(row: unknown): string {
  const input = JSON.stringify(row, Object.keys((row && typeof row === "object" && !Array.isArray(row)) ? row : {}).sort()) ?? String(row);
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function normalizeRow(row: DynacoreProviderRow): Record<CollectorField, unknown> {
  const price = providerPrice(row.price);
  return {
    // Preserve provider provenance. The shared validator must reject a row
    // that claims another source or market instead of silently repairing it.
    source_slug: text(row.source_slug),
    market: text(row.market),
    title: text(row.title),
    product_url: text(row.product_url),
    price,
    currency: text(row.currency) ?? (row.price && typeof row.price === "object" && !Array.isArray(row.price)
      ? text((row.price as Record<string, unknown>).currency)
      : null),
    availability: availability(row.availability ?? row.stock),
    sku: nullableText(row.sku),
    mpn: nullableText(row.mpn ?? row.manufacturer_part_number),
    manufacturer: nullableText(row.manufacturer),
    board_partner: nullableText(row.board_partner),
    raw_model: nullableText(row.raw_model),
    image_url: nullableText(row.image_url),
    scraped_at: text(row.scraped_at),
  };
}

export function adaptDynacoreOutput(
  input: unknown,
  options: { collectorId?: string; validatorResult?: "pending" | "passed" | "failed"; acceptedRowCount?: number } = {},
): DynacoreCapture {
  const extracted = extractCollectorRows(input);
  if (!extracted.ok) {
    throw new Error(`Dynacore provider output is ${extracted.code}`);
  }
  const rejected: DynacoreCapture["rejected"] = [];
  const rows: Record<CollectorField, unknown>[] = [];
  const rowIndexes: number[] = [];
  extracted.rows.forEach((candidate, rowIndex) => {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
      rejected.push({ rowIndex, reason: "malformed_row", rowFingerprint: fingerprintDynacoreRow(candidate) });
      return;
    }
    const row = candidate as DynacoreProviderRow;
    const title = text(row.title);
    if (title && ACCESSORY_TITLE_PATTERN.test(title)) {
      rejected.push({
        rowIndex,
        reason: "non_gpu_accessory",
        ...(typeof row.source_slug === "string" ? { sourceSlug: row.source_slug } : {}),
        rowFingerprint: fingerprintDynacoreRow(row),
      });
      return;
    }
    rows.push(normalizeRow(row));
    rowIndexes.push(rowIndex);
  });
  return {
    payload: { rows },
    evidence: {
      ...(options.collectorId ? { collector_id: options.collectorId } : {}),
      target_url: "https://dynacoretech.com/collections/gpu",
      catalog_url: "https://dynacoretech.com/collections/gpu",
      source_slug: "dynacore",
      market: "SG",
      currency: "SGD",
      manifest_name: "scrapers/manifests/dynacore.json",
      scraper_name: "raster-sg-dynacore-gpus",
      adapter_result: "passed",
      validator_result: options.validatorResult ?? "pending",
      source_card_count: extracted.rows.length,
      adapted_row_count: rows.length,
      accepted_row_count: options.acceptedRowCount ?? 0,
      quarantined_row_count: rejected.length,
      rejected_accessory_count: rejected.filter((item) => item.reason === "non_gpu_accessory").length,
      status: "completed",
      row_count: extracted.rows.length,
      valid_rows: rows.length,
      quarantined_rows: rejected.length,
      rows,
    },
    rejected,
    rowIndexes,
  };
}
