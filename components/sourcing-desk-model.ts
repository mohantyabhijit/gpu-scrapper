import type { Offer } from "../app/catalog";

export const SOURCE_DESK_LIMIT = 6;
export type SourceDeskOffer = Pick<Offer, "id" | "market" | "model" | "brand" | "source" | "currency" | "price" | "availability" | "observedAt" | "healthState" | "freshness" | "freshnessState" | "productUrl">;
export type ReadinessKey = "ready-to-verify" | "availability-unverified" | "source-needs-review" | "do-not-shortlist" | "demo-sample";
export type SourcingReadiness = { key: ReadinessKey; label: string; action: string };

const READINESS: Record<ReadinessKey, SourcingReadiness> = {
  "ready-to-verify": { key: "ready-to-verify", label: "Ready to verify", action: "Confirm price and stock at retailer" },
  "availability-unverified": { key: "availability-unverified", label: "Availability unverified", action: "Verify stock at retailer" },
  "source-needs-review": { key: "source-needs-review", label: "Source needs review", action: "Review source health before sourcing" },
  "do-not-shortlist": { key: "do-not-shortlist", label: "Do not shortlist", action: "Find an available offer" },
  "demo-sample": { key: "demo-sample", label: "Demo sample", action: "Do not treat as current inventory" },
};

export function encodeSourceDeskCatalog(offers: SourceDeskOffer[]): string {
  const bytes = new TextEncoder().encode(JSON.stringify(offers));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function decodeSourceDeskCatalog(blob: string): SourceDeskOffer[] {
  try {
    const binary = atob(blob);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes));
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

export function readinessForOffer(offer: SourceDeskOffer): SourcingReadiness {
  if (offer.healthState === "fixture" || offer.freshnessState === "fixture") return READINESS["demo-sample"];
  if (offer.availability === "Unavailable") return READINESS["do-not-shortlist"];
  if (offer.healthState !== "healthy" || offer.freshnessState === "stale") return READINESS["source-needs-review"];
  if (offer.availability === "Unknown") return READINESS["availability-unverified"];
  return READINESS["ready-to-verify"];
}

export function readinessSummary(offers: SourceDeskOffer[]) {
  const counts = Object.fromEntries(Object.keys(READINESS).map((key) => [key, 0])) as Record<ReadinessKey, number>;
  offers.forEach((offer) => { counts[readinessForOffer(offer).key] += 1; });
  const parts = [`${counts["ready-to-verify"]} ready to verify`];
  if (counts["availability-unverified"]) parts.push(`${counts["availability-unverified"]} availability unverified`);
  if (counts["source-needs-review"]) parts.push(`${counts["source-needs-review"]} source needs review`);
  if (counts["do-not-shortlist"]) parts.push(`${counts["do-not-shortlist"]} do not shortlist`);
  if (counts["demo-sample"]) parts.push(`${counts["demo-sample"]} demo sample${counts["demo-sample"] === 1 ? "" : "s"}`);
  return { counts, label: parts.join(" · "), mixedModels: new Set(offers.map((offer) => offer.model)).size > 1 };
}

export function isSafeUrl(value: unknown): value is string {
  try { const url = new URL(String(value)); return url.protocol === "https:" && Boolean(url.hostname); } catch { return false; }
}

function validatedStoredOffer(value: unknown): SourceDeskOffer | undefined {
  if (!value || typeof value !== "object") return undefined;
  const offer = value as Record<string, unknown>;
  const stringFields = ["id", "market", "model", "brand", "source", "currency", "availability", "observedAt", "healthState", "freshness", "freshnessState", "productUrl"];
  if (stringFields.some((field) => typeof offer[field] !== "string" || !(offer[field] as string).trim() || (offer[field] as string).length > 500)) return undefined;
  if (!/^[a-z0-9][a-z0-9._:-]{0,199}$/i.test(offer.id as string)) return undefined;
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(offer.market as string) || !/^[A-Z]{3}$/.test(offer.currency as string)) return undefined;
  if (!["In stock", "Low stock", "Unavailable", "Unknown"].includes(offer.availability as string)) return undefined;
  if (!["healthy", "degraded", "unavailable", "fixture"].includes(offer.healthState as string)) return undefined;
  if (!["fresh", "aging", "stale", "fixture"].includes(offer.freshnessState as string)) return undefined;
  if (Number.isNaN(Date.parse(offer.observedAt as string)) || !isSafeUrl(offer.productUrl)) return undefined;
  if (typeof offer.price !== "number" || !Number.isFinite(offer.price) || offer.price <= 0) return undefined;
  return offer as SourceDeskOffer;
}

export function canonicalizeStored(value: string | null, catalog: SourceDeskOffer[]): SourceDeskOffer[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    const byId = new Map(catalog.map((offer) => [offer.id, offer]));
    const restored = parsed.map((item) => {
      const id = item && typeof item === "object" && typeof (item as Record<string, unknown>).id === "string" ? (item as Record<string, unknown>).id as string : "";
      return byId.get(id) ?? validatedStoredOffer(item);
    });
    if (restored.some((offer) => !offer)) return [];
    const canonical = Array.from(new Map((restored as SourceDeskOffer[]).map((offer) => [offer.id, offer])).values()).slice(0, SOURCE_DESK_LIMIT);
    if (canonical.some((offer) => offer.market !== canonical[0]?.market || offer.currency !== canonical[0]?.currency)) return [];
    return canonical;
  } catch { return []; }
}

export function serializeSourceDesk(offers: SourceDeskOffer[]): string { return JSON.stringify(offers.slice(0, SOURCE_DESK_LIMIT)); }

export function savedOffersOutsideVisibleNote(selected: SourceDeskOffer[], visibleOfferIds: readonly string[]): string {
  const visible = new Set(visibleOfferIds);
  const outsideCount = selected.filter((offer) => !visible.has(offer.id)).length;
  return outsideCount === 0 ? "" : `${outsideCount} saved offer${outsideCount === 1 ? "" : "s"} outside current filters`;
}

export function selectSourceDeskOffer(selected: SourceDeskOffer[], offer: SourceDeskOffer, acknowledgeReplacement = false): { selected: SourceDeskOffer[]; pending: SourceDeskOffer | null; replaced: boolean } {
  if (selected.some((item) => item.id === offer.id)) return { selected: selected.filter((item) => item.id !== offer.id), pending: null, replaced: false };
  const boundaryMismatch = Boolean(selected[0] && (selected[0].market !== offer.market || selected[0].currency !== offer.currency));
  if (boundaryMismatch && !acknowledgeReplacement) return { selected, pending: offer, replaced: false };
  if (boundaryMismatch) return { selected: [offer], pending: null, replaced: true };
  if (selected.length >= SOURCE_DESK_LIMIT) return { selected, pending: null, replaced: false };
  return { selected: [...selected, offer], pending: null, replaced: false };
}

export function buildSourcingBrief(offers: SourceDeskOffer[], reminderDate = new Date().toISOString().slice(0, 10)): string {
  const summary = readinessSummary(offers);
  const lines = ["Raster sourcing brief", `Market: ${offers[0]?.market ?? "unknown market"} · Currency: ${offers[0]?.currency ?? "unknown currency"}`, `Sourcing readiness: ${summary.label}`, ...(summary.mixedModels ? ["Mixed GPU models — no like-for-like winner."] : []), "Selected offers (not a like-for-like comparison):", ...offers.map((offer, index) => { const readiness = readinessForOffer(offer); return [`${index + 1}. ${offer.brand} · ${offer.model}`, `   Retailer: ${offer.source} · ${offer.currency} ${offer.price}`, `   Availability: ${offer.availability} · Observed: ${offer.observedAt}`, `   Source health: ${offer.healthState} · ${offer.freshness}`, `   Readiness: ${readiness.label} · Next action: ${readiness.action}`, `   Retailer link: ${offer.productUrl}`].join("\n"); }), `Reminder (${reminderDate}): verify current price, stock, and product details at each retailer before sourcing.`];
  return lines.join("\n");
}
