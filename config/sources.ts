/**
 * Public source manifest. Collector IDs are deliberately absent until a
 * source passes the organizer's long-tail and pre-built-coverage checks.
 * Keep credentials out of this file; the live runner resolves them from its
 * secret store.
 */

export type SourceRole = "primary" | "secondary" | "backup";
export type MarketRegion = MarketCode;
export type Currency = MarketCurrency;
export type CollectorRole = "discovery" | "pdp" | "combined";
export type CollectorId = `c_${string}`;

/**
 * IDs are keyed by the Scraper Studio role so a source can grow from one
 * combined collector into discovery + PDP without changing its source slug.
 * Empty objects are intentional until the authenticated pre-built-library and
 * public-data gates pass and a real collector is created.
 */
export type CollectorIds = Partial<Record<CollectorRole, CollectorId>>;

export type SourceDefinition = {
  slug: string;
  displayName: string;
  role: SourceRole;
  region: MarketRegion;
  currency: Currency;
  baseUrl: string;
  allowedHosts: readonly string[];
  catalogUrl: string;
  enabled: boolean;
  collectorIds: CollectorIds;
  collectorRoles: readonly CollectorRole[];
};

export const sourceRegistry = {
  "central-computer": {
    slug: "central-computer",
    displayName: "Central Computers",
    role: "primary",
    region: "US",
    currency: "USD",
    baseUrl: "https://www.centralcomputer.com",
    allowedHosts: ["centralcomputer.com", "www.centralcomputer.com"],
    catalogUrl: "https://www.centralcomputer.com/all-products/hardware/video-cards/video-cards.html",
    enabled: false,
    collectorIds: {},
    collectorRoles: ["combined"],
  },
  "micro-center": {
    slug: "micro-center",
    displayName: "Micro Center",
    role: "secondary",
    region: "US",
    currency: "USD",
    baseUrl: "https://www.microcenter.com",
    allowedHosts: ["microcenter.com", "www.microcenter.com"],
    catalogUrl: "https://www.microcenter.com/site/products/graphics-cards.aspx",
    enabled: false,
    collectorIds: {},
    collectorRoles: ["combined"],
  },
  "overclockers-uk": {
    slug: "overclockers-uk",
    displayName: "Overclockers UK",
    role: "primary",
    region: "UK",
    currency: "GBP",
    baseUrl: "https://www.overclockers.co.uk",
    allowedHosts: ["overclockers.co.uk", "www.overclockers.co.uk"],
    catalogUrl: "https://www.overclockers.co.uk/pc-components/graphics-cards",
    enabled: false,
    collectorIds: {},
    collectorRoles: ["combined"],
  },
  ccl: {
    slug: "ccl",
    displayName: "CCL Computers",
    role: "secondary",
    region: "UK",
    currency: "GBP",
    baseUrl: "https://www.cclonline.com",
    allowedHosts: ["cclonline.com", "www.cclonline.com"],
    catalogUrl: "https://www.cclonline.com/pc-components/graphics-cards/",
    enabled: false,
    collectorIds: {},
    collectorRoles: ["combined"],
  },
  "md-computers": {
    slug: "md-computers",
    displayName: "MDComputers",
    role: "primary",
    region: "IN",
    currency: "INR",
    baseUrl: "https://mdcomputers.in",
    allowedHosts: ["mdcomputers.in", "www.mdcomputers.in"],
    catalogUrl: "https://mdcomputers.in/catalog/graphics-card/nvidia",
    enabled: false,
    collectorIds: {},
    collectorRoles: ["combined"],
  },
  "scl-gaming": {
    slug: "scl-gaming",
    displayName: "SCL Gaming",
    role: "secondary",
    region: "IN",
    currency: "INR",
    baseUrl: "https://sclgaming.in",
    allowedHosts: ["sclgaming.in", "www.sclgaming.in"],
    catalogUrl: "https://sclgaming.in/product-category/graphics-card/",
    enabled: false,
    collectorIds: {},
    collectorRoles: ["combined"],
  },
  dynacore: {
    slug: "dynacore",
    displayName: "Dynacore Technologies",
    role: "primary",
    region: "SG",
    currency: "SGD",
    baseUrl: "https://dynacoretech.com",
    allowedHosts: ["dynacoretech.com", "www.dynacoretech.com"],
    catalogUrl: "https://dynacoretech.com/collections/all/graphics-card",
    enabled: false,
    collectorIds: {},
    collectorRoles: ["combined"],
  },
  "tech-deals": {
    slug: "tech-deals",
    displayName: "TechDeals",
    role: "secondary",
    region: "SG",
    currency: "SGD",
    baseUrl: "https://www.techdeals.com.sg",
    allowedHosts: ["techdeals.com.sg", "www.techdeals.com.sg"],
    catalogUrl: "https://www.techdeals.com.sg/collections/graphics-card-1",
    enabled: false,
    collectorIds: {},
    collectorRoles: ["combined"],
  },
  "pc-themes": {
    slug: "pc-themes",
    displayName: "PC Themes",
    role: "backup",
    region: "SG",
    currency: "SGD",
    baseUrl: "https://www.pcthemes.com.sg",
    allowedHosts: ["pcthemes.com.sg", "www.pcthemes.com.sg"],
    catalogUrl: "https://www.pcthemes.com.sg/video-card-graphics-card",
    enabled: false,
    collectorIds: {},
    collectorRoles: ["combined"],
  },
} satisfies Record<string, SourceDefinition>;

function hasOwnSource(slug: string): boolean {
  return Object.prototype.hasOwnProperty.call(sourceRegistry, slug);
}

/** Runtime source IDs are PostgreSQL-owned; the static registry is only the fallback. */
export type SourceSlug = string;
export const SOURCE_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const MAX_SOURCE_SLUG_LENGTH = 64;

export function isSafeSourceSlug(value: unknown): value is SourceSlug {
  return typeof value === "string" && value.length > 0 && value.length <= MAX_SOURCE_SLUG_LENGTH && SOURCE_SLUG_PATTERN.test(value);
}

export function getSource(slug: string): SourceDefinition {
  if (!hasOwnSource(slug)) throw new Error(`Unknown source slug: ${slug}`);
  const source = sourceRegistry[slug as keyof typeof sourceRegistry];
  return source;
}

export function isKnownSource(slug: string): slug is SourceSlug {
  return isSafeSourceSlug(slug) && hasOwnSource(slug);
}

export function sourceHostIsAllowed(slug: string, url: string): boolean {
  return sourceHostIsAllowedForDefinition(getSource(slug), url);
}

export function sourceHostIsAllowedForDefinition(source: SourceDefinition, url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") return false;
  return source.allowedHosts.some(
    (host) => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`),
  );
}
import type { MarketCode, MarketCurrency } from "./markets.ts";
