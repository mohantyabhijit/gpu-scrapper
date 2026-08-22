"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { buildSourcingBrief, canonicalizeStored, isSafeUrl, savedOffersOutsideVisibleNote, selectSourceDeskOffer, serializeSourceDesk, SOURCE_DESK_LIMIT, type SourceDeskOffer } from "./sourcing-desk-model";

export { buildSourcingBrief, canonicalizeStored, selectSourceDeskOffer, serializeSourceDesk, SOURCE_DESK_LIMIT } from "./sourcing-desk-model";
export type { SourceDeskOffer } from "./sourcing-desk-model";
export const SOURCE_DESK_STORAGE_KEY = "raster.source-desk.v1";

type DeskContext = { selected: SourceDeskOffer[]; add: (offer: SourceDeskOffer) => void; remove: (offer: SourceDeskOffer) => void; selectedIds: Set<string> };
const DeskContext = createContext<DeskContext | null>(null);
function useDesk() { const value = useContext(DeskContext); if (!value) throw new Error("SourceDeskAddButton must be inside SourcingDesk"); return value; }

export function SourceDeskAddButton({ offer }: { offer: SourceDeskOffer }) {
  const { add, remove, selectedIds } = useDesk();
  const selected = selectedIds.has(offer.id);
  return <button className={`source-desk-add ${selected ? "is-added" : ""}`} type="button" onClick={() => selected ? remove(offer) : add(offer)} aria-pressed={selected} aria-label={`${selected ? "Remove" : "Add"} ${offer.model} from ${offer.source} ${selected ? "from" : "to"} source desk`}>{selected ? "Added to source desk ✓" : "Add to source desk +"}</button>;
}

function displayPrice(offer: SourceDeskOffer) { try { return new Intl.NumberFormat(undefined, { style: "currency", currency: offer.currency }).format(offer.price); } catch { return `${offer.currency} ${offer.price}`; } }

export default function SourcingDesk({ catalogBlob, visibleOfferIds, marketLabel, fixture, children }: { catalogBlob: string; visibleOfferIds: readonly string[]; marketLabel: string; fixture: boolean; children: ReactNode }) {
  const [selected, setSelected] = useState<SourceDeskOffer[]>([]);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<SourceDeskOffer | null>(null);
  const [status, setStatus] = useState("");
  const hydrated = useRef(false);
  const selectedIds = useMemo(() => new Set(selected.map((offer) => offer.id)), [selected]);
  const catalogOffers = useMemo<SourceDeskOffer[]>(() => { try { const parsed = JSON.parse(atob(catalogBlob)); return Array.isArray(parsed) ? parsed : []; } catch { return []; } }, [catalogBlob]);
  const byId = useMemo(() => new Map(catalogOffers.map((offer) => [offer.id, offer])), [catalogOffers]);
  const outsideCurrentFiltersNote = useMemo(() => savedOffersOutsideVisibleNote(selected, visibleOfferIds), [selected, visibleOfferIds]);

  useEffect(() => {
    try {
      // Hydrate after server render; canonicalize from the complete safe catalog, not filtered cards.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelected(canonicalizeStored(window.localStorage.getItem(SOURCE_DESK_STORAGE_KEY), catalogOffers));
      hydrated.current = true;
    } catch { /* unavailable storage fails closed */ }
  }, [catalogOffers]);
  useEffect(() => { if (hydrated.current) { try { window.localStorage.setItem(SOURCE_DESK_STORAGE_KEY, serializeSourceDesk(selected)); } catch { /* browser limitation */ } } }, [selected]);

  function persist(next: SourceDeskOffer[]) { setSelected(next.slice(0, SOURCE_DESK_LIMIT)); setStatus(""); }
  function add(offer: SourceDeskOffer) {
    const canonical = byId.get(offer.id); if (!canonical) return;
    const result = selectSourceDeskOffer(selected, canonical);
    if (result.pending) { setPending(result.pending); setOpen(true); setStatus(`This replaces the ${selected[0].market} desk. Acknowledgement is required.`); return; }
    if (result.selected.length === selected.length && selected.length >= SOURCE_DESK_LIMIT) { setStatus(`Source desk limit reached (${SOURCE_DESK_LIMIT} offers). Remove one before adding another.`); return; }
    persist(result.selected);
  }
  function remove(offer: SourceDeskOffer) { persist(selected.filter((item) => item.id !== offer.id)); }
  function replaceDesk() { if (pending) { const next = pending; const result = selectSourceDeskOffer(selected, next, true); persist(result.selected); setPending(null); setStatus(`Desk replaced with ${next.market}. Prices remain in ${next.currency}; no cross-market total was made.`); } }
  async function copyBrief() { const brief = buildSourcingBrief(selected); try { if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable"); await navigator.clipboard.writeText(brief); setStatus("Sourcing brief copied."); } catch { setStatus(`Clipboard unavailable. Select and copy this brief manually:\n\n${brief}`); } }

  return <DeskContext.Provider value={{ selected, add, remove, selectedIds }}><aside className="source-desk-summary" aria-label="Source desk summary"><div><span className="metric-label">SOURCE DESK</span><strong>{selected.length} {selected.length === 1 ? "offer" : "offers"} selected</strong><small>Stored only in this browser · {marketLabel} view</small>{outsideCurrentFiltersNote && <p className="source-desk-filter-note" role="status">{outsideCurrentFiltersNote}</p>}</div><div className="source-desk-summary-actions"><button className="button button-primary" type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open}>{open ? "Close source desk" : "Open source desk"}</button>{selected.length > 0 && <button className="button button-quiet" type="button" onClick={() => persist([])}>Clear desk</button>}</div></aside><div className="source-desk-note" aria-live="polite">{status}</div>{open && <section className="source-desk-panel" aria-label="Expanded source desk"><div className="source-desk-heading"><div><p className="eyebrow"><span>04</span> / SOURCING DESK</p><h2>{selected.length ? `${selected.length} selected for ${selected[0].market}` : "Your desk is empty."}</h2><p>{selected.length ? "Offers may span GPU models; this is a sourcing shortlist, not a like-for-like price comparison." : "Select offers from one market to hold their provenance here."}</p></div>{selected.length > 0 && <button className="button button-primary" type="button" onClick={copyBrief}>Copy sourcing brief</button>}</div>{pending && <div className="source-desk-confirm" role="alert"><strong>Replace current desk?</strong><p>Adding this {pending.market} offer would remove the current {selected[0]?.market} selection. Raster never mixes currencies or totals across markets.</p><button className="button button-primary" type="button" onClick={replaceDesk}>Acknowledge &amp; replace</button><button className="button button-quiet" type="button" onClick={() => setPending(null)}>Keep current desk</button></div>}{selected.length > 0 && <div className="source-desk-list">{selected.map((offer) => <article className="source-desk-item" key={offer.id}><div><p className="offer-model">{offer.model}</p><h3>{offer.brand}</h3><p>{offer.source} · {offer.market.toUpperCase()} / {offer.currency} · {displayPrice(offer)}</p></div><dl><div><dt>Observed</dt><dd>{offer.observedAt}</dd></div><div><dt>Availability</dt><dd>{offer.availability}</dd></div><div><dt>Source health</dt><dd>{offer.healthState}{fixture ? " · fixture" : ""}</dd></div></dl><a href={isSafeUrl(offer.productUrl) ? offer.productUrl : undefined} target="_blank" rel="noreferrer">Verify at retailer ↗</a><button className="button button-quiet" type="button" onClick={() => remove(offer)}>Remove</button></article>)}</div>}{selected.length === 0 && <p className="source-desk-empty">No offers selected. Your browser storage is fail-closed if saved data is invalid or stale.</p>}</section>}{children}</DeskContext.Provider>;
}
