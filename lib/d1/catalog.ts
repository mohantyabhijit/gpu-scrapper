import { isKnownSource, sourceHostIsAllowed } from "../../config/sources.ts";
import * as schema from "../../db/schema.ts";
import { offers as fixtureOffers, type Currency, type Market, type Offer } from "../../app/catalog.ts";
import { marketRegistry, type MarketDefinition } from "../../config/markets.ts";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { and, eq } from "drizzle-orm";
import { loadLatestHealingSession, type HealingSession } from "./healing-evidence.ts";

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
  readonly sourceAllowedHosts: string;
  readonly sourceEnabled: boolean;
  readonly sourceOnboardingStatus: string;
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
  readonly markets: readonly MarketDefinition[];
  readonly marketPacks: readonly MarketDefinition[];
  readonly selectedMarket: MarketDefinition;
  readonly fallbackReason?: "database-unavailable" | "database-empty" | "database-no-valid-rows";
};

export type CatalogQuery = (market?: MarketDefinition, modelSlug?: string) => Promise<readonly D1CatalogRow[]>;
export type MarketQuery = () => Promise<readonly MarketDefinition[]>;

/** Read the latest append-only healing proof without making catalog reads depend on it. */
export async function loadHealingEvidence(): Promise<HealingSession | undefined> {
  try {
    const { getDb } = await import("../../db/index.ts");
    return await loadLatestHealingSession(getDb());
  } catch {
    return undefined;
  }
}

const observedDateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "UTC",
});

function viewMarketCode(value: string): string | undefined {
  const code = value.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(code) ? code : undefined;
}

function viewCurrency(value: string): Currency | undefined {
  const code = value.trim().toUpperCase();
  return /^[A-Z]{3}$/.test(code) ? code : undefined;
}

function observedLabel(value: string): string | undefined {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return observedDateFormatter.format(date);
}

function availability(value: string): Offer["availability"] {
  if (value === "in_stock") return "In stock";
  if (value === "preorder") return "Low stock";
  if (value === "out_of_stock") return "Unavailable";
  return "Unknown";
}

export function classifyFreshness(observedAt: string, now = new Date()): Offer["freshnessState"] | undefined {
  const observed = new Date(observedAt);
  if (Number.isNaN(observed.getTime())) return undefined;
  const ageMs = now.getTime() - observed.getTime();
  if (ageMs < -5 * 60 * 1000) return undefined;
  if (ageMs <= 24 * 60 * 60 * 1000) return "fresh";
  if (ageMs <= 48 * 60 * 60 * 1000) return "aging";
  return "stale";
}

/**
 * Convert one normalized D1 join row into the storefront's view model.
 * Invalid or cross-market rows are rejected here so callers cannot compare
 * mismatched currencies even if a database contains a bad historical row.
 */
export function mapD1Offer(row: D1CatalogRow, definitions: readonly MarketDefinition[] = Object.values(marketRegistry), now = new Date()): Offer | undefined {
  const marketCode = viewMarketCode(row.offerMarket);
  const market = definitions.find((definition) => definition.code === marketCode);
  const currency = viewCurrency(row.offerCurrency.toUpperCase());
  const observed = observedLabel(row.observedAt);
  const freshnessState = classifyFreshness(row.observedAt, now);
  const sourceSlug = row.sourceSlug.trim();
  const productUrl = row.productUrl.trim();
  const sourceMarket = viewMarketCode(row.sourceMarket);
  const sourceCurrency = viewCurrency(row.sourceCurrency.toUpperCase());
  const expectedCurrency = sourceCurrency;

  if (!row.sourceEnabled || row.sourceOnboardingStatus !== "ready") return undefined;
  if (!market || !currency || !expectedCurrency || currency !== expectedCurrency || market.currency !== currency) return undefined;
  if (!sourceMarket || sourceMarket !== market.code || sourceCurrency !== currency) return undefined;
  if (!sourceSlug) return undefined;
  let allowedHosts: readonly string[] = [];
  try {
    const parsed = JSON.parse(row.sourceAllowedHosts || "[]");
    if (Array.isArray(parsed)) allowedHosts = parsed.filter((host): host is string => typeof host === "string");
  } catch { /* invalid source metadata is rejected below */ }
  let trustedUrl = false;
  if (isKnownSource(sourceSlug)) trustedUrl = sourceHostIsAllowed(sourceSlug, productUrl);
  if (!trustedUrl && allowedHosts.length > 0) {
    try {
      const parsed = new URL(productUrl);
      trustedUrl = parsed.protocol === "https:" && allowedHosts.some((host) => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`));
    } catch { trustedUrl = false; }
  }
  if (!productUrl || !trustedUrl) return undefined;
  if (!row.offerKey.trim() || !row.title.trim() || !row.productModel.trim()) return undefined;
  if (!Number.isSafeInteger(row.priceMinor) || row.priceMinor <= 0 || !observed || !freshnessState) return undefined;
  if (row.health !== "healthy" && row.health !== "degraded") return undefined;

  const degraded = row.health !== "healthy";
  const offerAvailability = availability(row.availability);
  const healthState = degraded ? "degraded" : offerAvailability === "Unavailable" ? "unavailable" : "healthy";
  const boardPartner = row.boardPartner?.trim() || "Unspecified board partner";
  const vram = row.vramGb && row.vramGb > 0 ? `${row.vramGb} GB VRAM` : "VRAM not listed";
  const freshness = `${freshnessState} · observed ${observed} UTC`;
  const freshnessTone = degraded || freshnessState === "stale" ? "stale" : freshnessState === "aging" ? "watch" : "fresh";

  return {
    id: row.offerKey,
    market: market.slug,
    modelSlug: row.productSlug.trim(),
    model: row.productModel.trim(),
    brand: boardPartner,
    vram,
    source: row.sourceDisplayName.trim() || sourceSlug,
    price: row.priceMinor / 100,
    currency,
    availability: offerAvailability,
    observedAt: row.observedAt,
    freshness,
    freshnessState,
    freshnessTone,
    healthState,
    productUrl,
    note: degraded ? "Live normalized row; degraded source, last-known-good state" : "Live normalized row; verify at retailer",
  };
}

async function queryD1Rows(db: CatalogDatabase, market?: MarketDefinition, modelSlug?: string): Promise<readonly D1CatalogRow[]> {
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
    sourceAllowedHosts: schema.sources.allowedHosts,
    sourceEnabled: schema.sources.enabled,
    sourceOnboardingStatus: schema.sources.onboardingStatus,
    productSlug: schema.products.slug,
    productModel: schema.products.model,
    boardPartner: schema.products.boardPartner,
    vramGb: schema.products.vramGb,
  }).from(schema.offers)
    .innerJoin(schema.products, eq(schema.offers.productIdentityKey, schema.products.identityKey))
    .innerJoin(schema.sources, eq(schema.offers.sourceSlug, schema.sources.slug));

  const marketCode = market?.code;
  const currency = market?.currency;
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
  } else if (market && marketCode && modelSlug) {
    rows = await selection.where(and(
      eq(schema.offers.market, marketCode),
      eq(schema.products.slug, modelSlug),
    )).all() as unknown as readonly D1CatalogRow[];
  } else if (modelSlug) {
    rows = await selection.where(eq(schema.products.slug, modelSlug)).all() as unknown as readonly D1CatalogRow[];
  } else {
    rows = await selection.all() as unknown as readonly D1CatalogRow[];
  }
  return rows;
}

function fixtureSnapshot(
  reason?: CatalogSnapshot["fallbackReason"],
  markets: readonly MarketDefinition[] = Object.values(marketRegistry),
  marketPacks: readonly MarketDefinition[] = [],
  selectedMarket: MarketDefinition = marketRegistry.us,
): CatalogSnapshot {
  return {
    source: "fixture",
    offers: [...fixtureOffers],
    liveOfferCount: null,
    rejectedRows: 0,
    markets,
    marketPacks,
    selectedMarket,
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
  marketQuery?: MarketQuery;
} = {}): Promise<CatalogSnapshot> {
  let query = options.query;
  let marketQuery = options.marketQuery;
  let markets: readonly MarketDefinition[] = Object.values(marketRegistry);
  let marketPacks: readonly MarketDefinition[] = [];
  if (!query) {
    try {
      const { getDb } = await import("../../db/index.ts");
      const db = getDb();
      query = (market, modelSlug) => queryD1Rows(db, market, modelSlug);
      marketQuery = marketQuery ?? (async () => {
        const rows = await db.select({
          slug: schema.marketPacks.slug,
          code: schema.marketPacks.countryCode,
          label: schema.marketPacks.label,
          currency: schema.marketPacks.currency,
          locale: schema.marketPacks.locale,
          baseUrl: schema.marketPacks.baseUrl,
          catalogUrl: schema.marketPacks.catalogUrl,
          symbol: schema.marketPacks.symbol,
          sourceDisplayName: schema.marketPacks.sourceDisplayName,
          eligibilityEvidenceRef: schema.marketPacks.eligibilityEvidenceRef,
          collectorCreatedEvidenceRef: schema.marketPacks.collectorCreatedEvidenceRef,
          collectorRunEvidenceRef: schema.marketPacks.collectorRunEvidenceRef,
          status: schema.marketPacks.status,
        }).from(schema.marketPacks).all();
        return rows.map((row) => ({
            slug: row.slug,
            code: row.code,
            label: row.label,
            currency: row.currency,
            locale: row.locale,
            symbol: row.symbol,
            enabled: row.status === "ready",
            ready: row.status === "ready",
            runtime: true,
            sourceDisplayName: row.sourceDisplayName,
            eligibilityProven: Boolean(row.eligibilityEvidenceRef),
            collectorCreatedProven: Boolean(row.collectorCreatedEvidenceRef),
            collectorRunProven: Boolean(row.collectorRunEvidenceRef),
          }));
      });
    } catch {
      const selectedMarket = markets.find((market) => market.slug === options.market) ?? marketRegistry.us;
      return fixtureSnapshot("database-unavailable", markets, marketPacks, selectedMarket);
    }
  }

  try {
    if (marketQuery) {
      const runtimeMarkets = await marketQuery();
      marketPacks = runtimeMarkets;
      const merged = new Map<string, MarketDefinition>(Object.values(marketRegistry).map((market) => [market.slug, market]));
      for (const runtime of runtimeMarkets) {
        if (runtime.enabled !== false && runtime.ready !== false) merged.set(runtime.slug, runtime);
      }
      markets = [...merged.values()];
    }
    const selectedMarket = markets.find((market) => market.slug === options.market) ?? marketRegistry.us;
    const rows = await query(selectedMarket, options.modelSlug);
    const mapped = rows.map((row) => mapD1Offer(row, markets)).filter((offer): offer is Offer => Boolean(offer));
    if (mapped.length === 0) {
      return fixtureSnapshot(rows.length > 0 ? "database-no-valid-rows" : "database-empty", markets, marketPacks, selectedMarket);
    }
    return {
      source: "d1",
      offers: mapped,
      markets,
      marketPacks,
      selectedMarket,
      liveOfferCount: mapped.length,
      rejectedRows: rows.length - mapped.length,
    };
  } catch {
    const selectedMarket = markets.find((market) => market.slug === options.market) ?? marketRegistry.us;
    return fixtureSnapshot("database-unavailable", markets, marketPacks, selectedMarket);
  }
}
