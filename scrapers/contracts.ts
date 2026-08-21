import { getSource, isKnownSource, isSafeSourceSlug, sourceHostIsAllowed, sourceHostIsAllowedForDefinition, type SourceDefinition, type SourceSlug } from "../config/sources.ts";
import {
  MARKET_CURRENCIES,
  marketCurrency,
  type MarketCode,
  type MarketCurrency,
} from "../config/markets.ts";

export { MARKET_CURRENCIES, marketCurrency };
export type { MarketCurrency };

export type Market = MarketCode;

export const AVAILABILITIES = [
  "in_stock",
  "out_of_stock",
  "preorder",
  "unknown",
] as const;

export type Availability = (typeof AVAILABILITIES)[number];

/** The wire contract is intentionally explicit: every collector row has all of these keys. */
export const COLLECTOR_FIELDS = [
  "source_slug",
  "market",
  "title",
  "product_url",
  "price",
  "currency",
  "availability",
  "sku",
  "mpn",
  "manufacturer",
  "board_partner",
  "raw_model",
  "image_url",
  "scraped_at",
] as const;

export type CollectorField = (typeof COLLECTOR_FIELDS)[number];
export const COLLECTOR_NULLABLE_FIELDS = [
  "sku",
  "mpn",
  "manufacturer",
  "board_partner",
  "raw_model",
  "image_url",
] as const satisfies readonly CollectorField[];

export type RawOffer = {
  source_slug?: string;
  market?: unknown;
  title?: unknown;
  product_url?: unknown;
  url?: unknown;
  price?: unknown;
  price_minor?: unknown;
  currency?: unknown;
  availability?: unknown;
  stock?: unknown;
  sku?: unknown;
  mpn?: unknown;
  manufacturer_part_number?: unknown;
  manufacturer?: unknown;
  board_partner?: unknown;
  raw_model?: unknown;
  image_url?: unknown;
  scraped_at?: unknown;
  [key: string]: unknown;
};

export type ValidatedOffer = {
  sourceSlug: SourceSlug;
  market: Market;
  title: string;
  productUrl: string;
  price: number | string;
  priceMinor?: number;
  currency: string;
  availability: Availability;
  sourceSku?: string;
  mpn?: string;
  manufacturer?: string;
  boardPartner?: string;
  rawModel?: string;
  imageUrl?: string;
  scrapedAt?: string;
  raw: RawOffer;
};

export type ValidationCode =
  | "not_an_object"
  | "unknown_source"
  | "title_required"
  | "url_required"
  | "url_not_allowed"
  | "price_required"
  | "price_invalid"
  | "currency_invalid"
  | "market_invalid"
  | "currency_market_mismatch"
  | "availability_invalid"
  | "scraped_at_invalid";

export type ValidationResult =
  | { ok: true; value: ValidatedOffer }
  | { ok: false; errors: ValidationCode[] };

function text(value: unknown): string | undefined {
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  const result = String(value).trim();
  return result || undefined;
}

function canonicalAvailability(value: unknown): Availability | undefined {
  const normalized = text(value)?.toLowerCase().replace(/[ -]+/g, "_");
  if (!normalized) return undefined;
  if (["in_stock", "instock", "available", "yes", "true"].includes(normalized)) {
    return "in_stock";
  }
  if (["out_of_stock", "outofstock", "unavailable", "sold_out", "no", "false"].includes(normalized)) {
    return "out_of_stock";
  }
  if (["preorder", "pre_order", "backorder", "back_order"].includes(normalized)) {
    return "preorder";
  }
  if (normalized === "unknown" || normalized === "n/a") return "unknown";
  return undefined;
}

function validPrice(value: unknown): boolean {
  if (typeof value === "number") return Number.isFinite(value) && value > 0;
  if (typeof value !== "string") return false;
  const cleaned = value.replace(/[^0-9.,-]/g, "").replace(/,/g, "").trim();
  return cleaned !== "" && Number.isFinite(Number(cleaned)) && Number(cleaned) > 0;
}

function validMinorPrice(value: unknown): boolean {
  if (typeof value === "number") return Number.isSafeInteger(value) && value > 0;
  return typeof value === "string" && /^\d+$/.test(value.trim()) && Number.isSafeInteger(Number(value)) && Number(value) > 0;
}

function validTimestamp(value: unknown): boolean {
  if (typeof value !== "string" || !value.trim()) return false;
  const timestamp = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.test(timestamp)) return false;
  return Number.isFinite(Date.parse(timestamp));
}

export function validateRawOffer(input: unknown, expectedSource?: string, expectedDefinition?: SourceDefinition): ValidationResult {
  const errors: ValidationCode[] = [];
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, errors: ["not_an_object"] };
  }
  const raw = input as RawOffer;
  const sourceSlug = text(raw.source_slug) ?? expectedSource;
  const knownSource = typeof sourceSlug === "string" && isSafeSourceSlug(sourceSlug) && (Boolean(expectedDefinition) || isKnownSource(sourceSlug));
  if (!knownSource) errors.push("unknown_source");
  const market = text(raw.market)?.toUpperCase() as string | undefined;
  const expectedCurrency = expectedDefinition?.currency ?? (market ? marketCurrency(market) : undefined);
  const validMarket = expectedDefinition ? market === expectedDefinition.region : Boolean(market && marketCurrency(market));
  if (!market || !validMarket) errors.push("market_invalid");
  const title = text(raw.title);
  if (!title) errors.push("title_required");
  const productUrl = text(raw.product_url) ?? text(raw.url);
  if (!productUrl) errors.push("url_required");
  else if (!knownSource || (expectedDefinition ? !sourceHostIsAllowedForDefinition(expectedDefinition, productUrl) : !sourceHostIsAllowed(sourceSlug as SourceSlug, productUrl))) errors.push("url_not_allowed");

  const rawPrice = raw.price_minor ?? raw.price;
  const usesMinorPrice = raw.price_minor !== undefined && raw.price_minor !== null && raw.price_minor !== "";
  if (rawPrice === undefined || rawPrice === null || rawPrice === "") errors.push("price_required");
  else if (!(usesMinorPrice ? validMinorPrice(rawPrice) : validPrice(rawPrice))) errors.push("price_invalid");

  const currency = text(raw.currency)?.toUpperCase();
  if (!currency || !/^[A-Z]{3}$/.test(currency)) errors.push("currency_invalid");
  else if (expectedCurrency && currency !== expectedCurrency) errors.push("currency_market_mismatch");
  if (expectedDefinition && (market !== expectedDefinition.region || currency !== expectedDefinition.currency)) {
    if (market !== expectedDefinition.region) errors.push("market_invalid");
    if (currency !== expectedDefinition.currency) errors.push("currency_market_mismatch");
  }
  const availability = canonicalAvailability(raw.availability ?? raw.stock);
  if (!availability) errors.push("availability_invalid");
  if (raw.scraped_at !== undefined && raw.scraped_at !== null && !validTimestamp(raw.scraped_at)) errors.push("scraped_at_invalid");

  if (errors.length || !sourceSlug || !title || !productUrl || !currency || !availability || !market || !expectedCurrency) {
    return { ok: false, errors };
  }
  const mpn = text(raw.mpn) ?? text(raw.manufacturer_part_number);
  const imageUrl = text(raw.image_url);
  return {
    ok: true,
    value: {
      sourceSlug: sourceSlug as SourceSlug,
      market: market as Market,
      title,
      productUrl,
      price: rawPrice as number | string,
      currency,
      availability,
      priceMinor: usesMinorPrice ? Number(rawPrice) : undefined,
      sourceSku: text(raw.sku),
      mpn,
      manufacturer: text(raw.manufacturer),
      boardPartner: text(raw.board_partner),
      rawModel: text(raw.raw_model),
      imageUrl,
      scrapedAt: text(raw.scraped_at),
      raw,
    },
  };
}

export type CollectorValidationCode =
  | "malformed_root"
  | "malformed_wrapper"
  | "empty_results"
  | "not_an_object"
  | "additional_field"
  | "contact_field"
  | "missing_field"
  | "unknown_source"
  | "market_invalid"
  | "currency_invalid"
  | "currency_market_mismatch"
  | "title_required"
  | "url_required"
  | "url_not_allowed"
  | "price_required"
  | "price_invalid"
  | "availability_invalid"
  | "timestamp_invalid"
  | "field_invalid";

export type CollectorValidationSummary = {
  ok: boolean;
  rowCount: number;
  acceptedCount: number;
  rejectedCount: number;
  errorCounts: Partial<Record<CollectorValidationCode, number>>;
};

type CollectorRowsResult =
  | { ok: true; rows: readonly unknown[] }
  | { ok: false; code: "malformed_root" | "malformed_wrapper" | "empty_results" };

const wrapperKeys = new Set(["data", "results", "rows", "items"]);
const contactFieldPattern = /(?:contact|email|phone|telephone|mobile|address|name|social|account|customer|seller)/i;

/** Extract only the row array shape Bright Data emits; no provider metadata is retained. */
export function extractCollectorRows(payload: unknown): CollectorRowsResult {
  if (Array.isArray(payload)) return payload.length ? { ok: true, rows: payload } : { ok: false, code: "empty_results" };
  if (!payload || typeof payload !== "object") return { ok: false, code: "malformed_root" };
  const keys = Object.keys(payload);
  const recognized = keys.filter((key) => wrapperKeys.has(key));
  if (recognized.length !== 1 || keys.length !== 1) return { ok: false, code: "malformed_wrapper" };
  const rows = (payload as Record<string, unknown>)[recognized[0]];
  if (!Array.isArray(rows)) return { ok: false, code: "malformed_wrapper" };
  return rows.length ? { ok: true, rows } : { ok: false, code: "empty_results" };
}

function incrementError(errors: Partial<Record<CollectorValidationCode, number>>, code: CollectorValidationCode): void {
  errors[code] = (errors[code] ?? 0) + 1;
}

function validateCollectorRow(row: unknown, expectedSource?: string): CollectorValidationCode[] {
  if (!row || typeof row !== "object" || Array.isArray(row)) return ["not_an_object"];
  const record = row as Record<string, unknown>;
  const errors: CollectorValidationCode[] = [];
  for (const key of Object.keys(record)) {
    if (!COLLECTOR_FIELDS.includes(key as CollectorField)) {
      errors.push(contactFieldPattern.test(key) ? "contact_field" : "additional_field");
    }
  }
  for (const field of COLLECTOR_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(record, field)) errors.push("missing_field");
  }
  if (errors.length) {
    // Preserve the complete shape check but avoid doing semantic work on a row
    // that cannot satisfy the published explicit contract.
    return errors;
  }
  const sourceSlug = record.source_slug;
  const source = typeof sourceSlug === "string" && isKnownSource(sourceSlug) ? sourceRegistryForValidation(sourceSlug) : undefined;
  if (!source || (expectedSource && sourceSlug !== expectedSource)) errors.push("unknown_source");
  const market = typeof record.market === "string" ? record.market.toUpperCase() : undefined;
  if (!market || !source || market !== source.region) errors.push("market_invalid");
  const currency = typeof record.currency === "string" ? record.currency.toUpperCase() : undefined;
  if (!currency || !/^[A-Z]{3}$/.test(currency)) errors.push("currency_invalid");
  if (source && currency && currency !== source.currency) errors.push("currency_market_mismatch");
  if (typeof record.title !== "string" || !record.title.trim()) errors.push("title_required");
  if (typeof record.product_url !== "string" || !record.product_url.trim()) errors.push("url_required");
  else if (source && !sourceHostIsAllowedForDefinition(source, record.product_url)) errors.push("url_not_allowed");
  if (record.price === null || record.price === undefined || record.price === "") errors.push("price_required");
  else if (!validPrice(record.price)) errors.push("price_invalid");
  if (typeof record.availability !== "string" || !AVAILABILITIES.includes(record.availability as Availability)) errors.push("availability_invalid");
  if (!validTimestamp(record.scraped_at)) errors.push("timestamp_invalid");
  for (const field of COLLECTOR_NULLABLE_FIELDS) {
    const value = record[field];
    if (value !== null && typeof value !== "string") errors.push("field_invalid");
  }
  if (record.image_url !== null && typeof record.image_url === "string") {
    try {
      if (new URL(record.image_url).protocol !== "https:") errors.push("field_invalid");
    } catch {
      errors.push("field_invalid");
    }
  }
  return errors;
}

// Kept as a tiny indirection so tests and the CLI cannot accidentally bypass the
// static registry when validating a row.
function sourceRegistryForValidation(slug: string): SourceDefinition | undefined {
  try {
    return getSource(slug);
  } catch {
    return undefined;
  }
}

/** Validate provider output without exposing or retaining any raw row content. */
export function validateCollectorOutput(payload: unknown, expectedSource?: string): CollectorValidationSummary {
  const extracted = extractCollectorRows(payload);
  if (!extracted.ok) {
    return {
      ok: false,
      rowCount: 0,
      acceptedCount: 0,
      rejectedCount: 0,
      errorCounts: { [extracted.code]: 1 },
    };
  }
  const errorCounts: Partial<Record<CollectorValidationCode, number>> = {};
  let acceptedCount = 0;
  for (const row of extracted.rows) {
    const errors = validateCollectorRow(row, expectedSource);
    if (errors.length) for (const error of errors) incrementError(errorCounts, error);
    else acceptedCount += 1;
  }
  return {
    ok: acceptedCount === extracted.rows.length,
    rowCount: extracted.rows.length,
    acceptedCount,
    rejectedCount: extracted.rows.length - acceptedCount,
    errorCounts,
  };
}
