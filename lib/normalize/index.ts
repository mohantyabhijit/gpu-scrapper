import {
  marketCurrency,
  type Availability,
  type Market,
  type ValidatedOffer,
} from "../../scrapers/contracts.ts";

export type NormalizedProduct = {
  identityKey: string;
  slug: string;
  gpuFamily: string;
  model: string;
  boardPartner?: string;
  vramGb?: number;
  mpn?: string;
  searchText: string;
};

export type NormalizedOffer = {
  offerKey: string;
  sourceSlug: string;
  market: Market;
  sourceSku?: string;
  product: NormalizedProduct;
  title: string;
  productUrl: string;
  imageUrl?: string;
  priceMinor: number;
  currency: string;
  availability: Availability;
  observedAt: string;
};

const MPN_KEY = /(?:mpn|part\s*(?:number|no\.?))\s*[:#-]?\s*([A-Z0-9][A-Z0-9._-]{3,})/i;
// Retailer titles commonly place trademark marks between the series and model
// (for example "RTX™ 5070"). Treat those marks as decoration, not identity.
const GPU_KEY = /\b(RTX|GTX|GT|RX|ARC)(?:\s*[™®])?\s*([0-9]{3,5})(?:\s*(XT|XTX|Ti|SUPER|Super))?/i;
const VRAM_KEY = /\b(\d{1,3})\s*(?:GB|GIB)\b/i;
const BOARD_PARTNERS = [
  "asus",
  "gigabyte",
  "msi",
  "pny",
  "zotac",
  "palit",
  "inno3d",
  "gainward",
  "sapphire",
  "xfx",
  "powercolor",
  "asrock",
  "intel",
  "nvidia",
  "amd",
];

function cleanToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function text(value: unknown): string | undefined {
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  const result = String(value).trim();
  return result || undefined;
}

export function toMinorUnits(value: number | string, currency: string): number {
  const exponent = currency.toUpperCase() === "JPY" ? 0 : 2;
  const cleaned = typeof value === "number" ? String(value) : value.replace(/[^0-9.,-]/g, "").replace(/,/g, "");
  if (!/^-?\d+(?:\.\d+)?$/.test(cleaned.trim())) throw new Error("invalid price");
  const [whole, fraction = ""] = cleaned.trim().split(".");
  const padded = `${fraction}${"0".repeat(exponent)}`.slice(0, exponent);
  const minor = Number(whole) * 10 ** exponent + (exponent ? Number(padded) : 0);
  if (!Number.isSafeInteger(minor) || minor <= 0) throw new Error("price must be a positive safe integer");
  return minor;
}

function discoverGpu(title: string): { family: string; model: string } {
  const match = title.match(GPU_KEY);
  if (!match) return { family: "GPU", model: "Unknown GPU" };
  const suffix = match[3] ? ` ${match[3].toUpperCase()}` : "";
  return { family: match[1].toUpperCase(), model: `${match[1].toUpperCase()} ${match[2]}${suffix}` };
}

function discoverBoardPartner(title: string, explicit?: string): string | undefined {
  const candidate = text(explicit)?.toLowerCase() ?? BOARD_PARTNERS.find((brand) => title.toLowerCase().includes(brand));
  return candidate ? candidate[0].toUpperCase() + candidate.slice(1) : undefined;
}

export function normalizeMpn(value?: string): string | undefined {
  const result = text(value)?.toUpperCase().replace(/[^A-Z0-9._-]/g, "");
  return result || undefined;
}

export function normalizeOffer(offer: ValidatedOffer, observedAt = "2026-08-21T00:00:00.000Z", expectedCurrency = marketCurrency(offer.market)): NormalizedOffer {
  if (!expectedCurrency || expectedCurrency !== offer.currency.toUpperCase()) {
    throw new Error("market and currency do not match");
  }
  const title = offer.title.trim();
  const gpu = discoverGpu(title);
  const boardPartner = discoverBoardPartner(title, offer.boardPartner);
  const vramMatch = title.match(VRAM_KEY);
  const vramGb = vramMatch ? Number(vramMatch[1]) : undefined;
  const explicitMpn = normalizeMpn(offer.mpn);
  const inferredMpn = !explicitMpn ? normalizeMpn(title.match(MPN_KEY)?.[1]) : undefined;
  const mpn = explicitMpn ?? inferredMpn;
  const identityKey = mpn
    ? `mpn:${mpn}`
    : `spec:${cleanToken(boardPartner ?? "unknown")}:${cleanToken(gpu.model)}:${vramGb ?? "na"}`;
  const product: NormalizedProduct = {
    identityKey,
    slug: cleanToken(identityKey),
    gpuFamily: gpu.family,
    model: gpu.model,
    boardPartner,
    vramGb,
    mpn,
    searchText: cleanToken(`${title} ${gpu.model} ${boardPartner ?? ""} ${mpn ?? ""}`),
  };
  const sourceSku = text(offer.sourceSku);
  const offerKey = `${offer.sourceSlug}:${sourceSku ? cleanToken(sourceSku) : cleanToken(offer.productUrl)}`;
  return {
    offerKey,
    sourceSlug: offer.sourceSlug,
    market: offer.market,
    sourceSku,
    product,
    title,
    productUrl: offer.productUrl,
    imageUrl: offer.imageUrl,
    priceMinor: offer.priceMinor ?? toMinorUnits(offer.price, offer.currency),
    currency: offer.currency.toUpperCase(),
    availability: offer.availability,
    observedAt: offer.scrapedAt ?? observedAt,
  };
}

export function canCompareOffers(left: NormalizedOffer, right: NormalizedOffer, expectedCurrency = marketCurrency(left.market)): boolean {
  return (
    left.market === right.market &&
    left.currency === right.currency &&
    expectedCurrency === left.currency
  );
}

/** Return only offers that are safe to rank against one another. */
export function comparableOffers(
  offers: readonly NormalizedOffer[],
  market: Market,
  expectedCurrency = marketCurrency(market),
): NormalizedOffer[] {
  if (!expectedCurrency) return [];
  return offers.filter((offer) => offer.market === market && offer.currency === expectedCurrency);
}
