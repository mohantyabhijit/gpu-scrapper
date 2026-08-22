import { extractCollectorRows, type CollectorField } from "../contracts.ts";

type ProviderRow = Record<string, unknown>;
type RejectionReason = "non_gpu_accessory" | "non_gpu_product" | "price_required" | "malformed_row";

export type PcThemesCapture = {
  payload: { rows: Record<CollectorField, unknown>[] };
  rowIndexes: number[];
  rejected: Array<{ rowIndex: number; reason: RejectionReason; sourceSlug?: string; rowFingerprint: string }>;
  evidence: {
    collector_id?: string;
    target_url: string;
    catalog_url: string;
    source_slug: "pc-themes";
    market: "SG";
    currency: "SGD";
    manifest_name: "scrapers/manifests/pc-themes.json";
    scraper_name: "raster-sg-pc-themes-gpus";
    adapter_result: "passed";
    validator_result: "pending" | "passed" | "failed";
    source_card_count: number;
    adapted_row_count: number;
    accepted_row_count: number;
    quarantined_row_count: number;
    status: "completed";
    rows: Record<CollectorField, unknown>[];
  };
};

const TARGET_URL = "https://www.pcthemes.com.sg/video-card-graphics-card";
const ACCESSORY_PATTERN = /\b(?:holder|bracket|stand|support|anti[- ]?sag|riser)\b/i;
const GPU_PATTERN = /\b(?:rtx|gtx|geforce|radeon|arc|rx\s*\d|graphics card|video card)\b/i;

function text(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const normalized = String(value).trim();
  return normalized || null;
}

function numericPrice(value: unknown): number | null {
  const candidate = value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>).value
    : value;
  if (typeof candidate === "number") return Number.isFinite(candidate) && candidate > 0 ? candidate : null;
  if (typeof candidate !== "string") return null;
  const cleaned = candidate.replace(/[^0-9.,-]/g, "").replace(/,/g, "").trim();
  const parsed = Number(cleaned);
  return cleaned && Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function stock(value: unknown): "in_stock" | "out_of_stock" | "preorder" | "unknown" {
  const normalized = text(value)?.toLowerCase().replace(/[ -]+/g, "_");
  if (!normalized) return "unknown";
  if (["in_stock", "instock", "available", "few_left", "yes", "true"].includes(normalized)) return "in_stock";
  if (["out_of_stock", "outofstock", "unavailable", "sold_out", "no", "false"].includes(normalized)) return "out_of_stock";
  if (["preorder", "pre_order", "backorder", "back_order"].includes(normalized)) return "preorder";
  return "unknown";
}

function fingerprint(row: unknown): string {
  const input = JSON.stringify(row, Object.keys((row && typeof row === "object" && !Array.isArray(row)) ? row : {}).sort()) ?? String(row);
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function isGpu(row: ProviderRow): boolean {
  const title = text(row.title) ?? "";
  if (ACCESSORY_PATTERN.test(title)) return false;
  const category = text(row.category)?.toLowerCase() ?? "";
  return GPU_PATTERN.test(title) || /^(?:gpu|graphics card|video card)$/.test(category);
}

function normalize(row: ProviderRow, price: number): Record<CollectorField, unknown> {
  const priceObject = row.price && typeof row.price === "object" && !Array.isArray(row.price)
    ? row.price as Record<string, unknown>
    : {};
  return {
    source_slug: text(row.source_slug),
    market: text(row.market),
    title: text(row.title),
    product_url: text(row.product_url) ?? text(row.canonical_product_url) ?? text(row.product_page_url),
    price,
    currency: text(row.currency) ?? text(priceObject.currency),
    availability: stock(row.availability ?? row.stock),
    sku: text(row.sku),
    mpn: text(row.mpn ?? row.manufacturer_part_number),
    manufacturer: text(row.manufacturer),
    board_partner: text(row.board_partner),
    raw_model: text(row.raw_model),
    image_url: text(row.image_url),
    scraped_at: text(row.scraped_at),
  };
}

export function adaptPcThemesOutput(
  input: unknown,
  options: { collectorId?: string; validatorResult?: "pending" | "passed" | "failed"; acceptedRowCount?: number } = {},
): PcThemesCapture {
  const extracted = extractCollectorRows(input);
  if (!extracted.ok) throw new Error(`PC Themes provider output is ${extracted.code}`);
  const rows: Record<CollectorField, unknown>[] = [];
  const rowIndexes: number[] = [];
  const rejected: PcThemesCapture["rejected"] = [];

  extracted.rows.forEach((candidate, rowIndex) => {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
      rejected.push({ rowIndex, reason: "malformed_row", rowFingerprint: fingerprint(candidate) });
      return;
    }
    const row = candidate as ProviderRow;
    const title = text(row.title) ?? "";
    if (ACCESSORY_PATTERN.test(title)) {
      rejected.push({ rowIndex, reason: "non_gpu_accessory", sourceSlug: text(row.source_slug) ?? undefined, rowFingerprint: fingerprint(row) });
      return;
    }
    if (!isGpu(row)) {
      rejected.push({ rowIndex, reason: "non_gpu_product", sourceSlug: text(row.source_slug) ?? undefined, rowFingerprint: fingerprint(row) });
      return;
    }
    const price = numericPrice(row.price ?? row.price_sgd);
    if (price === null) {
      rejected.push({ rowIndex, reason: "price_required", sourceSlug: text(row.source_slug) ?? undefined, rowFingerprint: fingerprint(row) });
      return;
    }
    rows.push(normalize(row, price));
    rowIndexes.push(rowIndex);
  });

  return {
    payload: { rows },
    rowIndexes,
    rejected,
    evidence: {
      ...(options.collectorId ? { collector_id: options.collectorId } : {}),
      target_url: TARGET_URL,
      catalog_url: TARGET_URL,
      source_slug: "pc-themes",
      market: "SG",
      currency: "SGD",
      manifest_name: "scrapers/manifests/pc-themes.json",
      scraper_name: "raster-sg-pc-themes-gpus",
      adapter_result: "passed",
      validator_result: options.validatorResult ?? "pending",
      source_card_count: extracted.rows.length,
      adapted_row_count: rows.length,
      accepted_row_count: options.acceptedRowCount ?? 0,
      quarantined_row_count: rejected.length,
      status: "completed",
      rows,
    },
  };
}
