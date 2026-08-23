"use client";

import { useEffect, useMemo, useState } from "react";
import type { Category, CountryCode, Hackathon } from "../data/hackathons";
import { rankedForCountry } from "../data/hackathons";
import OrbitScene from "./orbit-scene";

const countries: Array<{ code: CountryCode; label: string; short: string; note: string }> = [
  { code:"US", label:"United States", short:"USA", note:"Big pools · global online builds" },
  { code:"IN", label:"India", short:"India", note:"Dense student circuit · national rounds" },
  { code:"UK", label:"United Kingdom", short:"UK", note:"Campus weekends · applied AI" },
  { code:"SG", label:"Singapore", short:"Singapore", note:"Fintech, Web3 · compact high-signal field" },
];
const categories: Array<"All" | Category> = ["All", "AI", "Web3", "Web", "Mobile", "Climate", "Other"];
const apiBase = (process.env.NEXT_PUBLIC_HACKRADAR_API_URL ?? "/scrapper-api").replace(/\/$/, "");

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { month:"short", day:"numeric", year:"numeric" }).format(new Date(`${value}T12:00:00Z`));
}

function deadlineLabel(value: string) {
  const days = Math.ceil((Date.parse(`${value}T23:59:59Z`) - Date.now()) / 86_400_000);
  if (days < 0) return "Closed — verify next edition";
  if (days === 0) return "Closes today";
  return `${days} day${days === 1 ? "" : "s"} left`;
}

export default function HackathonExplorer({ initialHackathons }: { initialHackathons: Hackathon[] }) {
  const [country, setCountry] = useState<CountryCode>("SG");
  const [category, setCategory] = useState<"All" | Category>("All");
  const [items, setItems] = useState(initialHackathons);
  const [dataMode, setDataMode] = useState<"verified snapshot" | "live API">("verified snapshot");

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${apiBase}/hackathons?country=${country}&limit=50`, { signal: controller.signal })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("API unavailable")))
      .then((payload: { hackathons?: Hackathon[] }) => {
        if (Array.isArray(payload.hackathons) && payload.hackathons.length >= 10) {
          setItems((current) => [...current.filter((item) => !item.eligibleCountries.includes(country)), ...payload.hackathons!]);
          setDataMode("live API");
        }
      })
      .catch(() => setDataMode("verified snapshot"));
    return () => controller.abort();
  }, [country]);

  const ranked = useMemo(() => {
    const eligible = category === "All" ? items : items.filter((item) => item.categories.includes(category));
    return rankedForCountry(eligible, country, 10);
  }, [category, country, items]);
  const profile = countries.find((item) => item.code === country)!;
  const disclosedPool = ranked.reduce((sum, item) => sum + (item.prizeUsd ?? 0), 0);
  const localCount = ranked.filter((item) => item.venueCountry === country).length;

  return (
    <main className="site" data-country={country.toLowerCase()}>
      <nav className="nav" aria-label="Primary navigation">
        <a className="brand" href="#top" aria-label="HackRadar home"><span className="brand-glyph">H</span><span>hackradar</span><i /></a>
        <div className="nav-links"><a href="#rankings">Rankings</a><a href="#pipeline">How it heals</a><a href="https://github.com/mohantyabhijit/hackathon-scrapper" target="_blank" rel="noreferrer">GitHub ↗</a></div>
        <span className="fresh-pill"><i /> {dataMode}</span>
      </nav>

      <section className="hero" id="top">
        <div className="hero-copy">
          <span className="overline">A prize map for people who keep shipping</span>
          <h1>Your next build,<br /><em>properly ranked.</em></h1>
          <p>Hackathons across four builder markets, sorted by disclosed prize and annotated with the effort the brief actually demands.</p>
          <div className="country-control">
            <label htmlFor="country">I&apos;m participating from</label>
            <select id="country" value={country} onChange={(event) => { setCountry(event.target.value as CountryCode); setCategory("All"); }}>
              {countries.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}
            </select>
            <span>{profile.note}</span>
          </div>
        </div>
        <div className="hero-scene"><OrbitScene /><span className="scene-label label-a">Prize signal</span><span className="scene-label label-b">Effort model</span><span className="scene-label label-c">Source proof</span></div>
      </section>

      <section className="metrics" aria-label={`${profile.label} ranking summary`}>
        <div><span>View</span><strong>{profile.short}</strong><small>local + eligible online</small></div>
        <div><span>Ranked pool</span><strong>${Math.round(disclosedPool / 1000)}k</strong><small>disclosed USD-equivalent</small></div>
        <div><span>Local events</span><strong>{localCount}</strong><small>inside this top ten</small></div>
        <div><span>Source model</span><strong>3×</strong><small>Studio collectors</small></div>
      </section>

      <section className="rankings" id="rankings">
        <header className="section-head">
          <div><span className="section-index">01</span><div><p>Country leaderboard</p><h2>Top hackathons for {profile.label}</h2></div></div>
          <p>Prize ranking uses disclosed cash or prize-pool values. Unknown and non-cash prizes sort last. Always confirm eligibility at source.</p>
        </header>
        <div className="category-tabs" role="group" aria-label="Filter rankings by category">
          {categories.map((item) => <button key={item} type="button" className={category === item ? "active" : ""} onClick={() => setCategory(item)}>{item}</button>)}
        </div>
        <div className="leaderboard">
          {ranked.map((item, index) => (
            <article className="hack-row" key={item.id}>
              <div className="rank"><span>#</span>{String(index + 1).padStart(2, "0")}</div>
              <div className="hack-main">
                <div className="tags"><span>{item.mode}</span><span>{item.venueCountry === "GLOBAL" ? "Global / eligible" : `Local · ${item.venueCountry}`}</span>{item.categories.slice(0, 2).map((tag) => <span key={tag} className="category-tag">{tag}</span>)}</div>
                <h3>{item.title}</h3>
                <p>{item.summary}</p>
                <details><summary>View build brief</summary><div className="detail-grid"><span><b>Organizer</b>{item.organizer}</span><span><b>Dates</b>{formatDate(item.startDate)} – {formatDate(item.endDate)}</span><span><b>Effort</b>{item.effortNote}</span><span><b>Verified</b>{item.verifiedAt} via {item.source}</span></div></details>
              </div>
              <div className="hack-signal">
                <span className={`effort effort-${item.effort.toLowerCase()}`}>{item.effort}</span>
                <strong>{item.prizeDisplay}</strong>
                <small>{deadlineLabel(item.deadline)}</small>
                <a href={item.sourceUrl} target="_blank" rel="noreferrer">Original page <span>↗</span></a>
              </div>
            </article>
          ))}
          {ranked.length === 0 && <div className="empty"><strong>No {category} entries in this country snapshot.</strong><button type="button" onClick={() => setCategory("All")}>Show all categories</button></div>}
        </div>
      </section>

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
