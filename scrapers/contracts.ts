import { isKnownSource, sourceHostIsAllowed, type SourceSlug } from "../config/sources.ts";

/** Currency is part of the market contract, not a presentation concern. */
export const MARKET_CURRENCIES = {
  US: "USD",
  UK: "GBP",
  IN: "INR",
  SG: "SGD",
} as const;

export type Market = keyof typeof MARKET_CURRENCIES;
export type MarketCurrency = (typeof MARKET_CURRENCIES)[Market];

export function marketCurrency(market: string): MarketCurrency | undefined {
  return MARKET_CURRENCIES[market.toUpperCase() as Market];
}

export const AVAILABILITIES = [
  "in_stock",
  "out_of_stock",
  "preorder",
  "unknown",
] as const;

export type Availability = (typeof AVAILABILITIES)[number];

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
  | "availability_invalid";

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
  if (!normalized) return "unknown";
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

export function validateRawOffer(input: unknown, expectedSource?: string): ValidationResult {
  const errors: ValidationCode[] = [];
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, errors: ["not_an_object"] };
  }
  const raw = input as RawOffer;
  const sourceSlug = text(raw.source_slug) ?? expectedSource;
  const knownSource = typeof sourceSlug === "string" && isKnownSource(sourceSlug);
  if (!knownSource) errors.push("unknown_source");
  const market = text(raw.market)?.toUpperCase() as string | undefined;
  const expectedCurrency = market ? marketCurrency(market) : undefined;
  if (!market || !expectedCurrency) errors.push("market_invalid");
  const title = text(raw.title);
  if (!title) errors.push("title_required");
  const productUrl = text(raw.product_url) ?? text(raw.url);
  if (!productUrl) errors.push("url_required");
  else if (!knownSource || !sourceHostIsAllowed(sourceSlug as SourceSlug, productUrl)) errors.push("url_not_allowed");

  const rawPrice = raw.price_minor ?? raw.price;
  const usesMinorPrice = raw.price_minor !== undefined && raw.price_minor !== null && raw.price_minor !== "";
  if (rawPrice === undefined || rawPrice === null || rawPrice === "") errors.push("price_required");
  else if (!(usesMinorPrice ? validMinorPrice(rawPrice) : validPrice(rawPrice))) errors.push("price_invalid");

  const currency = text(raw.currency)?.toUpperCase();
  if (!currency || !/^[A-Z]{3}$/.test(currency)) errors.push("currency_invalid");
  else if (expectedCurrency && currency !== expectedCurrency) errors.push("currency_market_mismatch");
  const availability = canonicalAvailability(raw.availability ?? raw.stock);
  if (!availability) errors.push("availability_invalid");

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
      imageUrl,
      scrapedAt: text(raw.scraped_at),
      raw,
    },
  };
}
