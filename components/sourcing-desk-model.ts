import type { Offer } from "../app/catalog";

export const SOURCE_DESK_LIMIT = 6;
export type SourceDeskOffer = Pick<Offer, "id" | "market" | "model" | "brand" | "source" | "currency" | "price" | "availability" | "observedAt" | "healthState" | "freshness" | "productUrl">;

export function isSafeUrl(value: unknown): value is string {
  try { const url = new URL(String(value)); return (url.protocol === "https:" || url.protocol === "http:") && Boolean(url.hostname); } catch { return false; }
}

export function canonicalizeStored(value: string | null, catalog: SourceDeskOffer[]): SourceDeskOffer[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    const byId = new Map(catalog.map((offer) => [offer.id, offer]));
    const ids = parsed.map((item) => item && typeof item === "object" && typeof (item as Record<string, unknown>).id === "string" ? (item as Record<string, unknown>).id as string : null);
    if (ids.some((id) => !id || !byId.has(id))) return [];
    return Array.from(new Set(ids as string[])).slice(0, SOURCE_DESK_LIMIT).map((id) => byId.get(id)!);
  } catch { return []; }
}

export function serializeSourceDesk(offers: SourceDeskOffer[]): string { return JSON.stringify(offers.slice(0, SOURCE_DESK_LIMIT)); }

export function buildSourcingBrief(offers: SourceDeskOffer[], reminderDate = new Date().toISOString().slice(0, 10)): string {
  const lines = ["Raster sourcing brief", `Market: ${offers[0]?.market ?? "unknown market"} · Currency: ${offers[0]?.currency ?? "unknown currency"}`, "Selected offers (not a like-for-like comparison):", ...offers.map((offer, index) => [`${index + 1}. ${offer.brand} · ${offer.model}`, `   Retailer: ${offer.source} · ${offer.currency} ${offer.price}`, `   Availability: ${offer.availability} · Observed: ${offer.observedAt}`, `   Source health: ${offer.healthState} · ${offer.freshness}`, `   Retailer link: ${offer.productUrl}`].join("\n")), `Reminder (${reminderDate}): verify current price, stock, and product details at each retailer before sourcing.`];
  return lines.join("\n");
}
