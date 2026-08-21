export type Availability = "In stock" | "Low stock" | "Stale check";
import {
  marketRegistry,
  marketSlug,
  type MarketDefinition,
  type MarketCurrency,
  type MarketSlug,
} from "../config/markets.ts";

export type Market = MarketSlug;
export type Currency = MarketCurrency;

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
  freshness: string;
  freshnessTone: "fresh" | "watch" | "stale";
  productUrl: string;
  note: string;
};

export const markets: Record<string, MarketDefinition> = marketRegistry;

export const offers: Offer[] = [
  { id: "us-microcenter-5070ti", market: "us", modelSlug: "rtx-5070-ti", model: "GeForce RTX 5070 Ti", brand: "ASUS TUF Gaming", vram: "16 GB GDDR7", source: "Micro Center", price: 749.99, currency: "USD", availability: "In stock", freshness: "fixture · today", freshnessTone: "fresh", productUrl: "https://www.microcenter.com/product/688528/asus-nvidia-geforce-rtx-5070-ti-tuf-gaming-overclocked-triple-fan-16gb-gddr7-pcie-50-graphics-card", note: "Demo fixture; verify at retailer" },
  { id: "us-bh-5080", market: "us", modelSlug: "rtx-5080", model: "GeForce RTX 5080", brand: "PNY XLR8 Gaming", vram: "16 GB GDDR7", source: "B&H Photo", price: 1099.99, currency: "USD", availability: "Low stock", freshness: "fixture · today", freshnessTone: "watch", productUrl: "https://www.bhphotovideo.com/c/search?q=rtx%205080&sts=ma", note: "Demo fixture; verify at retailer" },
  { id: "uk-scan-5070ti", market: "uk", modelSlug: "rtx-5070-ti", model: "GeForce RTX 5070 Ti", brand: "MSI Ventus 3X", vram: "16 GB GDDR7", source: "Scan", price: 749.99, currency: "GBP", availability: "In stock", freshness: "fixture · today", freshnessTone: "fresh", productUrl: "https://www.scan.co.uk/search?q=rtx+5070+ti", note: "Demo fixture; verify at retailer" },
  { id: "uk-overclockers-5080", market: "uk", modelSlug: "rtx-5080", model: "GeForce RTX 5080", brand: "Gigabyte Gaming OC", vram: "16 GB GDDR7", source: "Overclockers UK", price: 1099.99, currency: "GBP", availability: "Stale check", freshness: "fixture · yesterday", freshnessTone: "stale", productUrl: "https://www.overclockers.co.uk/search?sSearch=rtx+5080", note: "Demo fixture; refresh before purchase" },
  { id: "india-md-5070ti", market: "india", modelSlug: "rtx-5070-ti", model: "GeForce RTX 5070 Ti", brand: "ZOTAC Solid OC", vram: "16 GB GDDR7", source: "MDComputers", price: 84999, currency: "INR", availability: "Low stock", freshness: "fixture · today", freshnessTone: "watch", productUrl: "https://mdcomputers.in/search?search=rtx%205070%20ti", note: "Demo fixture; verify at retailer" },
  { id: "india-vedant-5080", market: "india", modelSlug: "rtx-5080", model: "GeForce RTX 5080", brand: "ASUS Prime", vram: "16 GB GDDR7", source: "Vedant Computers", price: 129999, currency: "INR", availability: "In stock", freshness: "fixture · today", freshnessTone: "fresh", productUrl: "https://www.vedantcomputers.com/index.php?route=product/search&search=rtx%205080", note: "Demo fixture; verify at retailer" },
  { id: "sg-dynacore-5070ti", market: "singapore", modelSlug: "rtx-5070-ti", model: "GeForce RTX 5070 Ti", brand: "Palit GamingPro", vram: "16 GB GDDR7", source: "Dynacore", price: 1099, currency: "SGD", availability: "In stock", freshness: "fixture · today", freshnessTone: "fresh", productUrl: "https://www.dynacoretech.com/search?type=product&q=rtx+5070+ti", note: "Demo fixture; verify at retailer" },
  { id: "sg-techdeals-5080", market: "singapore", modelSlug: "rtx-5080", model: "GeForce RTX 5080", brand: "ZOTAC Solid OC", vram: "16 GB GDDR7", source: "TechDeals", price: 1940, currency: "SGD", availability: "Stale check", freshness: "fixture · yesterday", freshnessTone: "stale", productUrl: "https://www.techdeals.com.sg/collections/graphics-card-1", note: "Demo fixture; refresh before purchase" },
];

export function getMarket(value: string | undefined): Market {
  return marketSlug(value);
}
export function getMarketOffers(market: Market) { return offers.filter((offer) => offer.market === market); }
export function getModelOffers(slug: string, market: Market) { return offers.filter((offer) => offer.modelSlug === slug && offer.market === market); }
export function formatPrice(price: number, currency: Currency) {
  const locale = Object.values(markets).find((market) => market.currency === currency)?.locale ?? "en-US";
  return new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: currency === "USD" || currency === "GBP" ? 2 : 0 }).format(price);
}
export const models = Array.from(new Map(offers.map((offer) => [offer.modelSlug, { slug: offer.modelSlug, name: offer.model, vram: offer.vram }])).values());
