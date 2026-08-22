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
    status: "completed";
    row_count: number;
    valid_rows: number;
    quarantined_rows: number;
    rows: Record<CollectorField, unknown>[];
  };
  rejected: Array<{ rowIndex: number; reason: "non_gpu_accessory" | "malformed_row" }>;
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

function normalizeRow(row: DynacoreProviderRow): Record<CollectorField, unknown> {
  const price = providerPrice(row.price);
  return {
    source_slug: "dynacore",
    market: "SG",
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
  options: { collectorId?: string } = {},
): DynacoreCapture {
  const extracted = extractCollectorRows(input);
  if (!extracted.ok) {
    throw new Error(`Dynacore provider output is ${extracted.code}`);
  }
  const rejected: DynacoreCapture["rejected"] = [];
  const rows: Record<CollectorField, unknown>[] = [];
  extracted.rows.forEach((candidate, rowIndex) => {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
      rejected.push({ rowIndex, reason: "malformed_row" });
      return;
    }
    const row = candidate as DynacoreProviderRow;
    const title = text(row.title);
    if (title && ACCESSORY_TITLE_PATTERN.test(title)) {
      rejected.push({ rowIndex, reason: "non_gpu_accessory" });
      return;
    }
    rows.push(normalizeRow(row));
  });
  return {
    payload: { rows },
    evidence: {
      ...(options.collectorId ? { collector_id: options.collectorId } : {}),
      status: "completed",
      row_count: extracted.rows.length,
      valid_rows: rows.length,
      quarantined_rows: rejected.length,
      rows,
    },
    rejected,
  };
}
