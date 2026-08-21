import { isKnownSource, sourceHostIsAllowed, type SourceSlug } from "../../config/sources.ts";
import * as schema from "../../db/schema.ts";
import { offers as fixtureOffers, type Currency, type Market, type Offer } from "../../app/catalog.ts";
import { marketCurrency, marketForCode, marketRegistry } from "../../config/markets.ts";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { and, eq } from "drizzle-orm";

type CatalogDatabase = DrizzleD1Database<typeof schema>;

type D1CatalogRow = {
  readonly offerKey: string;
  readonly sourceSlug: string;
  readonly offerMarket: string;
  readonly offerCurrency: string;
  readonly title: string;
  readonly productUrl: string;
  readonly priceMinor: number;
  readonly availability: string;
  readonly observedAt: string;
  readonly health: string;
  readonly sourceMarket: string;
  readonly sourceCurrency: string;
  readonly sourceDisplayName: string;
  readonly productSlug: string;
  readonly productModel: string;
  readonly boardPartner: string | null;
  readonly vramGb: number | null;
};

export type CatalogSnapshot = {
  readonly source: "d1" | "fixture";
  readonly offers: readonly Offer[];
  readonly liveOfferCount: number | null;
  readonly rejectedRows: number;
  readonly fallbackReason?: "database-unavailable" | "database-empty" | "database-no-valid-rows";
};

export type CatalogQuery = (market?: Market, modelSlug?: string) => Promise<readonly D1CatalogRow[]>;

const observedDateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

function viewMarket(value: string): Market | undefined {
  return marketForCode(value)?.slug;
}

function viewCurrency(value: string): Currency | undefined {
  return value === "USD" || value === "GBP" || value === "INR" || value === "SGD" ? value : undefined;
}

function observedLabel(value: string): string | undefined {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return observedDateFormatter.format(date);
}

function availability(value: string, health: string): Offer["availability"] {
  if (health !== "healthy") return "Stale check";
  if (value === "in_stock") return "In stock";
  if (value === "preorder") return "Low stock";
  return "Stale check";
}

/**
 * Convert one normalized D1 join row into the storefront's view model.
 * Invalid or cross-market rows are rejected here so callers cannot compare
 * mismatched currencies even if a database contains a bad historical row.
 */
export function mapD1Offer(row: D1CatalogRow): Offer | undefined {
  const market = viewMarket(row.offerMarket);
  const currency = viewCurrency(row.offerCurrency.toUpperCase());
  const expectedCurrency = market ? marketRegistry[market].currency : undefined;
  const observed = observedLabel(row.observedAt);
  const sourceSlug = row.sourceSlug.trim();
  const productUrl = row.productUrl.trim();
  const sourceMarket = viewMarket(row.sourceMarket);
  const sourceCurrency = viewCurrency(row.sourceCurrency.toUpperCase());

  if (!market || !currency || currency !== expectedCurrency) return undefined;
  if (!sourceMarket || sourceMarket !== market || sourceCurrency !== currency) return undefined;
  if (!sourceSlug || !isKnownSource(sourceSlug)) return undefined;
  if (!productUrl || !sourceHostIsAllowed(sourceSlug as SourceSlug, productUrl)) return undefined;
  if (!row.offerKey.trim() || !row.title.trim() || !row.productModel.trim()) return undefined;
  if (!Number.isSafeInteger(row.priceMinor) || row.priceMinor <= 0 || !observed) return undefined;
  if (row.health !== "healthy" && row.health !== "degraded") return undefined;

  const stale = row.health !== "healthy";
  const boardPartner = row.boardPartner?.trim() || "Unspecified board partner";
  const vram = row.vramGb && row.vramGb > 0 ? `${row.vramGb} GB VRAM` : "VRAM not listed";
  const freshness = stale ? `live · degraded · observed ${observed}` : `live · observed ${observed}`;

  return {
    id: row.offerKey,
    market,
    modelSlug: row.productSlug.trim(),
    model: row.productModel.trim(),
    brand: boardPartner,
    vram,
    source: row.sourceDisplayName.trim() || sourceSlug,
    price: row.priceMinor / 100,
    currency,
    availability: availability(row.availability, row.health),
    freshness,
    freshnessTone: stale ? "stale" : "fresh",
    productUrl,
    note: stale ? "Live normalized row; last-known-good state" : "Live normalized row; verify at retailer",
  };
}

async function queryD1Rows(db: CatalogDatabase, market?: Market, modelSlug?: string): Promise<readonly D1CatalogRow[]> {
  const selection = db.select({
    offerKey: schema.offers.offerKey,
    sourceSlug: schema.offers.sourceSlug,
    offerMarket: schema.offers.market,
    offerCurrency: schema.offers.currency,
    title: schema.offers.title,
    productUrl: schema.offers.productUrl,
    priceMinor: schema.offers.priceMinor,
    availability: schema.offers.availability,
    observedAt: schema.offers.observedAt,
    health: schema.offers.health,
    sourceMarket: schema.sources.market,
    sourceCurrency: schema.sources.currency,
    sourceDisplayName: schema.sources.displayName,
    productSlug: schema.products.slug,
    productModel: schema.products.model,
    boardPartner: schema.products.boardPartner,
    vramGb: schema.products.vramGb,
  }).from(schema.offers)
    .innerJoin(schema.products, eq(schema.offers.productIdentityKey, schema.products.identityKey))
    .innerJoin(schema.sources, eq(schema.offers.sourceSlug, schema.sources.slug));

  const marketCode = market ? marketRegistry[market].code : undefined;
  const currency = marketCode ? marketCurrency(marketCode) : undefined;
  let rows: readonly D1CatalogRow[];
  if (market && marketCode && currency && modelSlug) {
    rows = await selection.where(and(
      eq(schema.offers.market, marketCode),
      eq(schema.offers.currency, currency),
      eq(schema.products.slug, modelSlug),
    )).all() as unknown as readonly D1CatalogRow[];
  } else if (market && marketCode && currency) {
    rows = await selection.where(and(
      eq(schema.offers.market, marketCode),
      eq(schema.offers.currency, currency),
    )).all() as unknown as readonly D1CatalogRow[];
  } else if (modelSlug) {
    rows = await selection.where(eq(schema.products.slug, modelSlug)).all() as unknown as readonly D1CatalogRow[];
  } else {
    rows = await selection.all() as unknown as readonly D1CatalogRow[];
  }
  return rows;
}

function fixtureSnapshot(reason?: CatalogSnapshot["fallbackReason"]): CatalogSnapshot {
  return {
    source: "fixture",
    offers: [...fixtureOffers],
    liveOfferCount: null,
    rejectedRows: 0,
    ...(reason ? { fallbackReason: reason } : {}),
  };
}

/**
 * Read normalized offers when D1 is available, otherwise return the clearly
 * labelled fixture catalog. The query is injectable for deterministic tests.
 */
export async function loadCatalog(options: {
  market?: Market;
  modelSlug?: string;
  query?: CatalogQuery;
} = {}): Promise<CatalogSnapshot> {
  let query = options.query;
  if (!query) {
    try {
      const { getDb } = await import("../../db/index.ts");
      const db = getDb();
      query = (market, modelSlug) => queryD1Rows(db, market, modelSlug);
    } catch {
      return fixtureSnapshot("database-unavailable");
    }
  }

  try {
    const rows = await query(options.market, options.modelSlug);
    const mapped = rows.map(mapD1Offer).filter((offer): offer is Offer => Boolean(offer));
    if (mapped.length === 0) {
      return fixtureSnapshot(rows.length > 0 ? "database-no-valid-rows" : "database-empty");
    }
    return {
      source: "d1",
      offers: mapped,
      liveOfferCount: mapped.length,
      rejectedRows: rows.length - mapped.length,
    };
  } catch {
    return fixtureSnapshot("database-unavailable");
  }
}
