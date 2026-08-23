"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Category, Hackathon, MarketCode } from "../data/hackathons";
import { marketMoney, prizeForMarket, rankedForCountry } from "../data/hackathons";
import OrbitScene from "./orbit-scene";

const countries: Array<{ code: MarketCode; label: string; short: string; note: string }> = [
  { code:"WORLD", label:"Worldwide", short:"World", note:"Every indexed market · one global leaderboard" },
  { code:"US", label:"United States", short:"USA", note:"Big pools · global online builds" },
  { code:"IN", label:"India", short:"India", note:"Dense student circuit · national rounds" },
  { code:"UK", label:"United Kingdom", short:"UK", note:"Campus weekends · applied AI" },
  { code:"SG", label:"Singapore", short:"Singapore", note:"Fintech, Web3 · compact high-signal field" },
];
const categories: Array<"All" | Category> = ["All", "AI", "Web3", "Web", "Mobile", "Climate", "Other"];
const apiBase = (process.env.NEXT_PUBLIC_HACKRADAR_API_URL ?? "/scrapper-api").replace(/\/$/, "");

function uniqueById(items: readonly Hackathon[]) {
  return [...new Map(items.map((item) => [item.id, item])).values()];
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { month:"short", day:"numeric", year:"numeric" }).format(new Date(`${value}T12:00:00Z`));
}

function deadlineLabel(value: string) {
  const days = Math.ceil((Date.parse(`${value}T23:59:59Z`) - Date.now()) / 86_400_000);
  if (days < 0) return "Closed — verify next edition";
  if (days === 0) return "Closes today";
  return `${days} day${days === 1 ? "" : "s"} left`;
}

const countryNames: Record<Exclude<MarketCode, "WORLD">, string> = {
  US: "United States",
  IN: "India",
  UK: "United Kingdom",
  SG: "Singapore",
};

function eligibilityLabel(item: Hackathon) {
  if (item.eligibleCountries.length === Object.keys(countryNames).length) return "Every indexed country";
  return item.eligibleCountries.map((code) => countryNames[code]).join(", ");
}

export default function HackathonExplorer({ initialHackathons }: { initialHackathons: Hackathon[] }) {
  const [country, setCountry] = useState<MarketCode>("SG");
  const [category, setCategory] = useState<"All" | Category>("All");
  const [items, setItems] = useState(initialHackathons);
  const [dataMode, setDataMode] = useState<"checking live API" | "verified snapshot" | "live API">("checking live API");
  const [selectedHackathon, setSelectedHackathon] = useState<Hackathon | null>(null);
  const requestGeneration = useRef(0);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const detailTriggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const generation = ++requestGeneration.current;
    fetch(`${apiBase}/hackathons?country=${country}&limit=50`, { signal: controller.signal })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("API unavailable")))
      .then((payload: { hackathons?: Hackathon[] }) => {
        if (generation !== requestGeneration.current || controller.signal.aborted) return;
        if (!Array.isArray(payload.hackathons) || payload.hackathons.length < 10) throw new Error("API returned too few rows");
        setItems((current) => country === "WORLD"
          ? uniqueById(payload.hackathons!)
          : uniqueById([...current.filter((item) => !item.eligibleCountries.includes(country)), ...payload.hackathons!]));
        setDataMode("live API");
      })
      .catch(() => {
        if (generation !== requestGeneration.current || controller.signal.aborted) return;
        setItems(initialHackathons);
        setDataMode("verified snapshot");
      });
    return () => controller.abort();
  }, [country, initialHackathons]);

  useEffect(() => {
    if (!selectedHackathon) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setSelectedHackathon(null);
        detailTriggerRef.current?.focus();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href]');
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [selectedHackathon]);

  function openDetails(item: Hackathon, trigger: HTMLButtonElement) {
    detailTriggerRef.current = trigger;
    setSelectedHackathon(item);
  }

  function closeDetails() {
    setSelectedHackathon(null);
    detailTriggerRef.current?.focus();
  }

  const ranked = useMemo(() => {
    const eligible = category === "All" ? items : items.filter((item) => item.categories.includes(category));
    return rankedForCountry(eligible, country, 10);
  }, [category, country, items]);
  const profile = countries.find((item) => item.code === country)!;
  const hasDisclosedPrize = ranked.some((item) => item.prizeUsd !== null);
  const disclosedPool = ranked.reduce((sum, item) => sum + (item.prizeUsd ?? 0), 0);
  const localCount = country === "WORLD"
    ? new Set(ranked.map((item) => item.venueCountry).filter((value) => value !== "GLOBAL")).size
    : ranked.filter((item) => item.venueCountry === country).length;
  const poolMoney = hasDisclosedPrize ? prizeForMarket(disclosedPool, country) : null;

  return (
    <main className="site" data-country={country.toLowerCase()}>
      <nav className="nav" aria-label="Primary navigation">
        <a className="brand" href="#top" aria-label="HackRadar home"><span className="brand-glyph">H</span><span>hackradar</span><i /></a>
        <div className="nav-links"><a href="#rankings">Rankings</a><a href="#pipeline">How it heals</a><a href="https://github.com/mohantyabhijit/hackathon-scrapper" target="_blank" rel="noreferrer">GitHub ↗</a></div>
        <span className="fresh-pill" aria-live="polite"><i /> {dataMode}</span>
      </nav>

      <section className="hero" id="top">
        <div className="hero-copy">
          <span className="overline">A prize map for people who keep shipping</span>
          <h1>Your next build,<br /><em>properly ranked.</em></h1>
          <p>Worldwide hackathons plus four focused builder markets, ranked by disclosed prize and annotated with the effort the brief actually demands.</p>
          <div className="country-control">
            <label htmlFor="country">Browse market</label>
            <select id="country" value={country} onChange={(event) => { setDataMode("checking live API"); setCountry(event.target.value as MarketCode); setCategory("All"); }}>
              {countries.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}
            </select>
            <span>{profile.note}</span>
          </div>
        </div>
        <div className="hero-scene"><OrbitScene /><span className="scene-label label-a">Prize signal</span><span className="scene-label label-b">Effort model</span><span className="scene-label label-c">Source proof</span></div>
      </section>

      <section className="metrics" aria-label={`${profile.label} ranking summary`}>
        <div><span>View</span><strong>{profile.short}</strong><small>{country === "WORLD" ? "all indexed opportunities" : "local + eligible online"}</small></div>
        <div><span>Ranked pool</span><strong>{poolMoney?.local ?? "Undisclosed"}</strong><small>{poolMoney ? (poolMoney.isUsdMarket ? "USD comparison total" : `${poolMoney.usd} USD · estimated FX`) : "no comparable cash value"}</small></div>
        <div><span>{country === "WORLD" ? "Markets" : "Local events"}</span><strong>{localCount}</strong><small>{country === "WORLD" ? "represented in this top ten" : "inside this top ten"}</small></div>
        <div><span>Source model</span><strong>3×</strong><small>Studio collectors</small></div>
      </section>

      <section className="rankings" id="rankings">
        <header className="section-head" aria-live="polite">
          <div><span className="section-index">01</span><div><p>{country === "WORLD" ? "Worldwide leaderboard" : "Country leaderboard"}</p><h2>{country === "WORLD" ? "Top hackathons worldwide" : `Top hackathons for ${profile.label}`}</h2></div></div>
          <p>Prize ranking uses USD equivalents. Country views also show an estimated local-currency value; source claims remain authoritative.</p>
        </header>
        <div className="category-tabs" role="group" aria-label="Filter rankings by category">
          {categories.map((item) => <button key={item} type="button" aria-pressed={category === item} className={category === item ? "active" : ""} onClick={() => setCategory(item)}>{item}</button>)}
        </div>
        <p className="fx-note">FX reference: 23 Aug 2026 normalization rates · display estimates only.</p>
        <div className="leaderboard">
          {ranked.map((item, index) => {
            const prize = prizeForMarket(item.prizeUsd, country);
            return (
            <article className="hack-row" key={item.id}>
              <div className="rank"><span>#</span>{String(index + 1).padStart(2, "0")}</div>
              <div className="hack-main">
                <div className="tags"><span>{item.mode}</span><span>{item.venueCountry === "GLOBAL" ? "Global / eligible" : `Local · ${item.venueCountry}`}</span>{item.categories.slice(0, 2).map((tag) => <span key={tag} className="category-tag">{tag}</span>)}</div>
                <h3>{item.title}</h3>
                <p>{item.summary}</p>
                <button className="hack-details-button" type="button" aria-label={`Open details for ${item.title}`} onClick={(event) => openDetails(item, event.currentTarget)}>View details</button>
              </div>
              <div className="hack-signal">
                <span className={`effort effort-${item.effort.toLowerCase()}`}>{item.effort}</span>
                <strong>{prize?.local ?? item.prizeDisplay}</strong>
                <span className="prize-usd">{prize ? (prize.isUsdMarket ? `${prize.usd} USD` : `${prize.usd} USD · est. ${marketMoney[country].currency}`) : "No comparable USD value disclosed"}</span>
                <small>{deadlineLabel(item.deadline)}</small>
                <a href={item.sourceUrl} target="_blank" rel="noreferrer">Original page <span>↗</span></a>
              </div>
            </article>
            );
          })}
          {ranked.length === 0 && <div className="empty"><strong>No {category} entries in this country snapshot.</strong><button type="button" onClick={() => setCategory("All")}>Show all categories</button></div>}
        </div>
      </section>

      {selectedHackathon && (() => {
        const modalPrize = prizeForMarket(selectedHackathon.prizeUsd, country);
        return <div className="hack-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeDetails(); }}>
          <div ref={dialogRef} className="hack-modal" role="dialog" aria-modal="true" aria-labelledby="hack-modal-title" aria-describedby="hack-modal-summary">
            <button ref={closeButtonRef} className="hack-modal-close" type="button" onClick={closeDetails} aria-label="Close hackathon details">×</button>
            <div className="hack-modal-kicker"><span>{selectedHackathon.source}</span><span>{selectedHackathon.mode}</span><span>{selectedHackathon.venueCountry === "GLOBAL" ? "Global" : countryNames[selectedHackathon.venueCountry]}</span></div>
            <h2 id="hack-modal-title">{selectedHackathon.title}</h2>
            <p id="hack-modal-summary" className="hack-modal-summary">{selectedHackathon.summary}</p>
            <dl className="hack-modal-grid">
              <div><dt>Organizer</dt><dd>{selectedHackathon.organizer}</dd></div>
              <div><dt>Schedule</dt><dd>{formatDate(selectedHackathon.startDate)} – {formatDate(selectedHackathon.endDate)}</dd></div>
              <div><dt>Registration deadline</dt><dd>{formatDate(selectedHackathon.deadline)}<small>{deadlineLabel(selectedHackathon.deadline)}</small></dd></div>
              <div><dt>Prize at source</dt><dd>{selectedHackathon.prizeDisplay}{modalPrize && <small>{modalPrize.local} · {modalPrize.usd} USD estimate</small>}</dd></div>
              <div><dt>Eligible markets</dt><dd>{eligibilityLabel(selectedHackathon)}</dd></div>
              <div><dt>Categories</dt><dd>{selectedHackathon.categories.join(" · ")}</dd></div>
              <div><dt>Build effort</dt><dd>{selectedHackathon.effort}<small>{selectedHackathon.effortNote}</small></dd></div>
              <div><dt>Source verification</dt><dd>{selectedHackathon.source}<small>Checked {formatDate(selectedHackathon.verifiedAt)}</small></dd></div>
            </dl>
            <div className="hack-modal-footer">
              <p>Organizer rules and the original listing remain authoritative.</p>
              <a href={selectedHackathon.sourceUrl} target="_blank" rel="noreferrer">View original page <span aria-hidden="true">↗</span></a>
            </div>
          </div>
        </div>;
      })()}

      <section className="pipeline" id="pipeline">
        <header className="section-head"><div><span className="section-index">02</span><div><p>Scraper Studio core</p><h2>The model holds when pages move.</h2></div></div><p>Extraction can change. The product contract cannot.</p></header>
        <div className="pipeline-grid">
          <div><span>01</span><b>Discover</b><p>Public Devpost, Unstop, and Hackathons UK pages.</p></div>
          <div><span>02</span><b>Validate</b><p>Dates, prizes, URLs, country eligibility, and provenance.</p></div>
          <div><span>03</span><b>Diagnose</b><p>Python compares each run to the stored schema and last good model.</p></div>
          <div className="heal-step"><span>04</span><b>Heal in place</b><p>AI writes a narrow repair prompt; Bright Data keeps the same collector ID.</p></div>
        </div>
      </section>

      <footer><a className="brand" href="#top"><span className="brand-glyph">H</span><span>hackradar</span><i /></a><p>Public pages only · prize amounts are source claims · eligibility must be verified</p><span>Built with Next.js, Three.js, FastAPI &amp; Bright Data</span></footer>
    </main>
  );
}
