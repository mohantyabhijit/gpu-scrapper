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

export type MarketSlug = keyof typeof marketRegistry;
export type MarketDefinition = (typeof marketRegistry)[MarketSlug];
export type MarketCode = MarketDefinition["code"];
export type MarketCurrency = MarketDefinition["currency"];

const marketsByCode = Object.fromEntries(
  Object.values(marketRegistry).map((market) => [market.code, market]),
) as Record<MarketCode, MarketDefinition>;

export const MARKET_CURRENCIES = Object.fromEntries(
  Object.values(marketRegistry).map((market) => [market.code, market.currency]),
) as Record<MarketCode, MarketCurrency>;

export function marketSlug(value: string | undefined): MarketSlug {
  return value && value in marketRegistry ? value as MarketSlug : "us";
}

export function marketForCode(value: string): MarketDefinition | undefined {
  return marketsByCode[value.toUpperCase() as MarketCode];
}

export function marketCurrency(value: string): MarketCurrency | undefined {
  return marketForCode(value)?.currency;
}
