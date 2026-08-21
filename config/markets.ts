/**
 * One operator-owned registry drives routing, display, validation, and storage.
 * Onboarding a country still requires an approved source and collector; users
 * cannot bypass those gates with arbitrary market or currency input.
 */
export const marketRegistry = {
  us: { slug: "us", code: "US", label: "United States", currency: "USD", locale: "en-US", symbol: "$" },
  uk: { slug: "uk", code: "UK", label: "United Kingdom", currency: "GBP", locale: "en-GB", symbol: "£" },
  india: { slug: "india", code: "IN", label: "India", currency: "INR", locale: "en-IN", symbol: "₹" },
  singapore: { slug: "singapore", code: "SG", label: "Singapore", currency: "SGD", locale: "en-SG", symbol: "S$" },
} as const;

export type MarketSlug = string;
export type MarketCode = string;
export type MarketCurrency = string;
export type MarketDefinition = {
  readonly slug: MarketSlug;
  readonly code: MarketCode;
  readonly label: string;
  readonly currency: MarketCurrency;
  readonly locale: string;
  readonly symbol: string;
  readonly enabled?: boolean;
  readonly ready?: boolean;
};

const marketsByCode = Object.fromEntries(
  Object.values(marketRegistry).map((market) => [market.code, market]),
) as Record<MarketCode, MarketDefinition>;

export const MARKET_CURRENCIES = Object.fromEntries(
  Object.values(marketRegistry).map((market) => [market.code, market.currency]),
) as Record<MarketCode, MarketCurrency>;

export function marketSlug(value: string | undefined): MarketSlug {
  return value && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) ? value : "us";
}

export function marketForCode(value: string): MarketDefinition | undefined {
  return marketsByCode[value.toUpperCase() as keyof typeof marketsByCode];
}

export function marketCurrency(value: string): MarketCurrency | undefined {
  return marketForCode(value)?.currency;
}

/**
 * Runtime market manifests are deliberately normalized at this boundary.
 * Unknown or disabled records never become selectable storefront markets.
 */
export function readyMarkets(definitions: readonly MarketDefinition[] = Object.values(marketRegistry)): readonly MarketDefinition[] {
  return definitions.filter((market) => market.enabled !== false && market.ready !== false);
}

export function marketBySlug(slug: string, definitions: readonly MarketDefinition[] = Object.values(marketRegistry)): MarketDefinition | undefined {
  return readyMarkets(definitions).find((market) => market.slug === slug);
}
