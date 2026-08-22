"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Offer } from "../app/catalog";

export const SOURCE_DESK_STORAGE_KEY = "raster.source-desk.v1";
export const SOURCE_DESK_LIMIT = 6;

export type SourceDeskOffer = Pick<Offer, "id" | "market" | "model" | "brand" | "source" | "currency" | "price" | "availability" | "observedAt" | "healthState" | "freshness" | "productUrl">;

function isSafeUrl(value: unknown): value is string {
  try {
    const url = new URL(String(value));
    return (url.protocol === "https:" || url.protocol === "http:") && Boolean(url.hostname);
  } catch {
    return false;
  }
}

function parseStored(value: string | null): SourceDeskOffer[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is SourceDeskOffer => {
      if (!item || typeof item !== "object") return false;
      const offer = item as Record<string, unknown>;
      return typeof offer.id === "string" && typeof offer.market === "string" && typeof offer.model === "string"
        && typeof offer.brand === "string" && typeof offer.source === "string" && typeof offer.currency === "string"
        && typeof offer.price === "number" && Number.isFinite(offer.price) && typeof offer.availability === "string"
        && typeof offer.observedAt === "string" && Number.isFinite(Date.parse(offer.observedAt)) && typeof offer.healthState === "string" && typeof offer.freshness === "string"
        && isSafeUrl(offer.productUrl);
    }).slice(0, SOURCE_DESK_LIMIT);
  } catch {
    return [];
  }
}

export function serializeSourceDesk(offers: SourceDeskOffer[]): string {
  return JSON.stringify(offers.slice(0, SOURCE_DESK_LIMIT));
}

export function buildSourcingBrief(offers: SourceDeskOffer[], reminderDate = new Date().toISOString().slice(0, 10)): string {
  const market = offers[0]?.market ?? "unknown market";
  const currency = offers[0]?.currency ?? "unknown currency";
  const lines = [
    "Raster sourcing brief",
    `Market: ${market} · Currency: ${currency}`,
    "Selected offers (not a like-for-like comparison):",
    ...offers.map((offer, index) => [
      `${index + 1}. ${offer.brand} · ${offer.model}`,
      `   Retailer: ${offer.source} · ${offer.currency} ${offer.price}`,
      `   Availability: ${offer.availability} · Observed: ${offer.observedAt}`,
      `   Source health: ${offer.healthState} · ${offer.freshness}`,
      `   Retailer link: ${offer.productUrl}`,
    ].join("\n")),
    `Reminder (${reminderDate}): verify current price, stock, and product details at each retailer before sourcing.`,
  ];
  return lines.join("\n");
}

function displayPrice(offer: SourceDeskOffer) {
  try { return new Intl.NumberFormat(undefined, { style: "currency", currency: offer.currency }).format(offer.price); }
  catch { return `${offer.currency} ${offer.price}`; }
}

export default function SourcingDesk({ offers, marketLabel, fixture }: { offers: SourceDeskOffer[]; marketLabel: string; fixture: boolean }) {
  const [selected, setSelected] = useState<SourceDeskOffer[]>([]);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<SourceDeskOffer | null>(null);
  const [status, setStatus] = useState("");
  const hydrated = useRef(false);
  const selectedIds = useMemo(() => new Set(selected.map((offer) => offer.id)), [selected]);

  useEffect(() => {
    try {
      // Hydrate after the server render so browser-only storage cannot alter the HTML response.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      const currentIds = new Set(offers.map((offer) => offer.id));
      setSelected(parseStored(window.localStorage.getItem(SOURCE_DESK_STORAGE_KEY)).filter((offer) => currentIds.has(offer.id)));
      hydrated.current = true;
    } catch { /* unavailable storage fails closed */ }
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    try { window.localStorage.setItem(SOURCE_DESK_STORAGE_KEY, serializeSourceDesk(selected)); }
    catch { /* unavailable storage is a browser-local limitation */ }
  }, [selected]);

  function persist(next: SourceDeskOffer[]) {
    setSelected(next.slice(0, SOURCE_DESK_LIMIT));
    setStatus("");
  }

  function add(offer: SourceDeskOffer) {
    if (selectedIds.has(offer.id)) { persist(selected.filter((item) => item.id !== offer.id)); return; }
    if (selected.length > 0 && selected[0].market !== offer.market) { setPending(offer); setStatus(`This replaces the ${selected[0].market} desk. Acknowledgement is required.`); return; }
    if (selected.length >= SOURCE_DESK_LIMIT) { setStatus(`Source desk limit reached (${SOURCE_DESK_LIMIT} offers). Remove one before adding another.`); return; }
    persist([...selected, offer]);
  }

  function replaceDesk() {
    if (!pending) return;
    persist([pending]);
    setPending(null);
    setStatus(`Desk replaced with ${pending.market}. Prices remain in ${pending.currency}; no cross-market total was made.`);
  }

  async function copyBrief() {
    const brief = buildSourcingBrief(selected);
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(brief);
      setStatus("Sourcing brief copied.");
    } catch {
      setStatus(`Clipboard unavailable. Select and copy this brief manually:\n\n${brief}`);
    }
  }

  return <>
    <aside className="source-desk-summary" aria-label="Source desk summary">
      <div><span className="metric-label">SOURCE DESK</span><strong>{selected.length} {selected.length === 1 ? "offer" : "offers"} selected</strong><small>Stored only in this browser · {marketLabel} view</small></div>
      <div className="source-desk-summary-actions"><button className="button button-primary" type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open}>{open ? "Close source desk" : "Open source desk"}</button>{selected.length > 0 && <button className="button button-quiet" type="button" onClick={() => persist([])}>Clear desk</button>}</div>
    </aside>
    <div className="source-desk-note" aria-live="polite">{status}</div>
    {open && <section className="source-desk-panel" aria-label="Expanded source desk">
      <div className="source-desk-heading"><div><p className="eyebrow"><span>04</span> / SOURCING DESK</p><h2>{selected.length ? `${selected.length} selected for ${selected[0].market}` : "Your desk is empty."}</h2><p>{selected.length ? "Offers may span GPU models; this is a sourcing shortlist, not a like-for-like price comparison." : "Select offers from one market to hold their provenance here."}</p></div>{selected.length > 0 && <button className="button button-primary" type="button" onClick={copyBrief}>Copy sourcing brief</button>}</div>
      {pending && <div className="source-desk-confirm" role="alert"><strong>Replace current desk?</strong><p>Adding this {pending.market} offer would remove the current {selected[0]?.market} selection. Raster never mixes currencies or totals across markets.</p><button className="button button-primary" type="button" onClick={replaceDesk}>Acknowledge &amp; replace</button><button className="button button-quiet" type="button" onClick={() => setPending(null)}>Keep current desk</button></div>}
      {selected.length > 0 && <div className="source-desk-list">{selected.map((offer) => <article className="source-desk-item" key={offer.id}><div><p className="offer-model">{offer.model}</p><h3>{offer.brand}</h3><p>{offer.source} · {offer.market.toUpperCase()} / {offer.currency} · {displayPrice(offer)}</p></div><dl><div><dt>Observed</dt><dd>{offer.observedAt}</dd></div><div><dt>Availability</dt><dd>{offer.availability}</dd></div><div><dt>Source health</dt><dd>{offer.healthState}{fixture ? " · fixture" : ""}</dd></div></dl><a href={isSafeUrl(offer.productUrl) ? offer.productUrl : undefined} target="_blank" rel="noreferrer">Verify at retailer ↗</a><button className="button button-quiet" type="button" onClick={() => add(offer)}>Remove</button></article>)}</div>}
      {selected.length === 0 && <p className="source-desk-empty">No offers selected. Your browser storage is fail-closed if saved data is invalid or stale.</p>}
    </section>}
    <div className="source-desk-cards" aria-label="Add offers to source desk">{offers.map((offer) => <button className={`source-desk-add ${selectedIds.has(offer.id) ? "is-added" : ""}`} type="button" key={offer.id} onClick={() => add(offer)} aria-pressed={selectedIds.has(offer.id)} aria-label={`${selectedIds.has(offer.id) ? "Remove" : "Add"} ${offer.model} from ${offer.source} ${selectedIds.has(offer.id) ? "from" : "to"} source desk`}>{selectedIds.has(offer.id) ? "Added to source desk ✓" : "Add to source desk +"}</button>)}</div>
  </>;
}
