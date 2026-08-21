export type Availability = "In stock" | "Low stock" | "Unavailable" | "Unknown";
import {
  marketRegistry,
  marketSlug,
  type MarketDefinition,
  type MarketCurrency,
  type MarketSlug,
} from "../config/markets.ts";

export type Market = MarketSlug;
export type Currency = MarketCurrency;
export type FreshnessState = "fresh" | "aging" | "stale" | "fixture";
export type HealthState = "healthy" | "degraded" | "unavailable" | "fixture";

export type Offer = {
  id: string;
  market: Market;
  modelSlug: string;
  model: string;
  brand: string;
  vram: string;
  source: string;
  price: number;
  currency: Currency;
  availability: Availability;
  observedAt: string;
  freshness: string;
  freshnessState: FreshnessState;
  freshnessTone: "fresh" | "watch" | "stale";
  healthState: HealthState;
  productUrl: string;
  note: string;
};

export const markets: Record<string, MarketDefinition> = marketRegistry;

export const offers: Offer[] = [
  { id: "us-microcenter-5070ti", market: "us", modelSlug: "rtx-5070-ti", model: "GeForce RTX 5070 Ti", brand: "ASUS TUF Gaming", vram: "16 GB GDDR7", source: "Micro Center", price: 749.99, currency: "USD", availability: "In stock", observedAt: "2026-08-21T10:00:00.000Z", freshness: "fixture sample · 21 Aug 2026, 10:00 UTC", freshnessState: "fixture", freshnessTone: "watch", healthState: "fixture", productUrl: "https://www.microcenter.com/product/688528/asus-nvidia-geforce-rtx-5070-ti-tuf-gaming-overclocked-triple-fan-16gb-gddr7-pcie-50-graphics-card", note: "Demo fixture; verify at retailer" },
  { id: "us-bh-5080", market: "us", modelSlug: "rtx-5080", model: "GeForce RTX 5080", brand: "PNY XLR8 Gaming", vram: "16 GB GDDR7", source: "B&H Photo", price: 1099.99, currency: "USD", availability: "Low stock", observedAt: "2026-08-21T10:05:00.000Z", freshness: "fixture sample · 21 Aug 2026, 10:05 UTC", freshnessState: "fixture", freshnessTone: "watch", healthState: "fixture", productUrl: "https://www.bhphotovideo.com/c/search?q=rtx%205080&sts=ma", note: "Demo fixture; verify at retailer" },
  { id: "uk-scan-5070ti", market: "uk", modelSlug: "rtx-5070-ti", model: "GeForce RTX 5070 Ti", brand: "MSI Ventus 3X", vram: "16 GB GDDR7", source: "Scan", price: 749.99, currency: "GBP", availability: "In stock", observedAt: "2026-08-21T10:10:00.000Z", freshness: "fixture sample · 21 Aug 2026, 10:10 UTC", freshnessState: "fixture", freshnessTone: "watch", healthState: "fixture", productUrl: "https://www.scan.co.uk/search?q=rtx+5070+ti", note: "Demo fixture; verify at retailer" },
  { id: "uk-overclockers-5080", market: "uk", modelSlug: "rtx-5080", model: "GeForce RTX 5080", brand: "Gigabyte Gaming OC", vram: "16 GB GDDR7", source: "Overclockers UK", price: 1099.99, currency: "GBP", availability: "Unknown", observedAt: "2026-08-20T10:15:00.000Z", freshness: "fixture sample · 20 Aug 2026, 10:15 UTC", freshnessState: "fixture", freshnessTone: "watch", healthState: "fixture", productUrl: "https://www.overclockers.co.uk/search?sSearch=rtx+5080", note: "Demo fixture; verify at retailer" },
  { id: "india-md-5070ti", market: "india", modelSlug: "rtx-5070-ti", model: "GeForce RTX 5070 Ti", brand: "ZOTAC Solid OC", vram: "16 GB GDDR7", source: "MDComputers", price: 84999, currency: "INR", availability: "Low stock", observedAt: "2026-08-21T10:20:00.000Z", freshness: "fixture sample · 21 Aug 2026, 10:20 UTC", freshnessState: "fixture", freshnessTone: "watch", healthState: "fixture", productUrl: "https://mdcomputers.in/search?search=rtx%205070%20ti", note: "Demo fixture; verify at retailer" },
  { id: "india-vedant-5080", market: "india", modelSlug: "rtx-5080", model: "GeForce RTX 5080", brand: "ASUS Prime", vram: "16 GB GDDR7", source: "Vedant Computers", price: 129999, currency: "INR", availability: "In stock", observedAt: "2026-08-21T10:25:00.000Z", freshness: "fixture sample · 21 Aug 2026, 10:25 UTC", freshnessState: "fixture", freshnessTone: "watch", healthState: "fixture", productUrl: "https://www.vedantcomputers.com/index.php?route=product/search&search=rtx%205080", note: "Demo fixture; verify at retailer" },
  { id: "sg-dynacore-5070ti", market: "singapore", modelSlug: "rtx-5070-ti", model: "GeForce RTX 5070 Ti", brand: "Palit GamingPro", vram: "16 GB GDDR7", source: "Dynacore", price: 1099, currency: "SGD", availability: "In stock", observedAt: "2026-08-21T10:30:00.000Z", freshness: "fixture sample · 21 Aug 2026, 10:30 UTC", freshnessState: "fixture", freshnessTone: "watch", healthState: "fixture", productUrl: "https://www.dynacoretech.com/search?type=product&q=rtx+5070+ti", note: "Demo fixture; verify at retailer" },
  { id: "sg-techdeals-5080", market: "singapore", modelSlug: "rtx-5080", model: "GeForce RTX 5080", brand: "ZOTAC Solid OC", vram: "16 GB GDDR7", source: "TechDeals", price: 1940, currency: "SGD", availability: "Unknown", observedAt: "2026-08-20T10:35:00.000Z", freshness: "fixture sample · 20 Aug 2026, 10:35 UTC", freshnessState: "fixture", freshnessTone: "watch", healthState: "fixture", productUrl: "https://www.techdeals.com.sg/collections/graphics-card-1", note: "Demo fixture; verify at retailer" },
];

export function getMarket(value: string | undefined): Market {
  return marketSlug(value);
}
export function getMarketOffers(market: Market) { return offers.filter((offer) => offer.market === market); }
export function getModelOffers(slug: string, market: Market) { return offers.filter((offer) => offer.modelSlug === slug && offer.market === market); }
export function formatPrice(price: number, currency: Currency, locale?: string) {
  const resolvedLocale = locale ?? Object.values(markets).find((market) => market.currency === currency)?.locale ?? "en-US";
  return new Intl.NumberFormat(resolvedLocale, { style: "currency", currency }).format(price);
}
export const models = Array.from(new Map(offers.map((offer) => [offer.modelSlug, { slug: offer.modelSlug, name: offer.model, vram: offer.vram }])).values());
