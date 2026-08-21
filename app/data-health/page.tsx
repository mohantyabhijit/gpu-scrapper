import Link from "next/link";
import { markets, type Market } from "../catalog";
import { loadCatalog } from "../../lib/d1/catalog";

type HealthTone = "ready" | "pending" | "planned";
type EvidenceKind = "fixture" | "provider" | "policy";

type HealthEvidence = {
  readonly kind: EvidenceKind;
  readonly label: string;
  readonly href?: string;
};

type HealthCheckKey = "fixture-catalog" | "live-collectors" | "scheduler-trigger" | "self-heal";

type HealthCheck = {
  readonly key: HealthCheckKey;
  readonly label: string;
  readonly state: string;
  readonly tone: HealthTone;
  readonly detail: string;
  readonly evidence: readonly HealthEvidence[];
};

type MarketHealth = {
  readonly market: Market;
  readonly tone: HealthTone;
  readonly note: string;
};

const marketOrder: readonly Market[] = ["us", "uk", "india", "singapore"];

const marketHealth: readonly MarketHealth[] = marketOrder.map((market) => ({
  market,
  tone: "ready",
  note: "Fixture rows only · live provider not configured",
}));

const pipelineChecks: readonly HealthCheck[] = [
  {
    key: "fixture-catalog",
    label: "Fixture catalog",
    state: "Ready for demo",
    tone: "ready",
    detail: "Market-local fixture rows are labelled and rendered without live freshness claims.",
    evidence: [
      { kind: "fixture", label: "Fixture data" },
      { kind: "policy", label: "No live freshness" },
    ],
  },
  {
    key: "live-collectors",
    label: "Live collectors",
    state: "Pending · not configured",
    tone: "pending",
    detail: "No production collector IDs are claimed in this build.",
    evidence: [{ kind: "provider", label: "Not configured" }],
  },
  {
    key: "scheduler-trigger",
    label: "Scheduler / trigger",
    state: "Pending · not configured",
    tone: "pending",
    detail: "The downstream trigger is reserved for the Bright Data integration milestone.",
    evidence: [
      { kind: "provider", label: "Not configured" },
      { kind: "policy", label: "Trigger gate" },
    ],
  },
  {
    key: "self-heal",
    label: "Self-heal",
    state: "Planned · evidence required",
    tone: "planned",
    detail: "A repair is only considered real after the same collector is healed, validated, and rerun.",
    evidence: [
      { kind: "policy", label: "Policy: same-ID repair" },
      { kind: "fixture", label: "Evidence required" },
    ],
  },
];

export default async function DataHealth() {
  const snapshot = await loadCatalog();
  const liveRead = snapshot.source === "d1";
  const liveRowsLabel = liveRead
    ? `${snapshot.liveOfferCount ?? snapshot.offers.length} normalized D1 rows`
    : snapshot.fallbackReason === "database-empty"
      ? "pending · no normalized rows"
      : "pending · DB read unavailable";
  const displayedChecks: readonly HealthCheck[] = liveRead
    ? pipelineChecks.map((check) => check.key === "fixture-catalog"
      ? {
        ...check,
        label: "D1 normalized offers",
        state: `${snapshot.liveOfferCount ?? snapshot.offers.length} rows read`,
        detail: "Rows passed the market, currency, source, URL, and timestamp checks before entering the storefront.",
        evidence: [
          { kind: "provider", label: "D1 read" },
          { kind: "policy", label: "Schema validated" },
        ],
      }
      : check)
    : pipelineChecks;
  return (
    <main className="site-shell health-page">
      <div className="demo-banner" role="note">
        <span className="pulse-dot" aria-hidden="true" />
        <strong>{liveRead ? "D1 NORMALIZED READ" : "FIXTURE CATALOG"}</strong>
        <span>{liveRead ? `${liveRowsLabel}. Collector execution status remains separate and is not inferred from a database read.` : "Health here describes the current demo state; it does not claim a live scrape or production freshness."}</span>
      </div>

      <header className="topbar">
        <Link href="/" className="brand">
          <span className="brand-mark" aria-hidden="true">R</span>
          <span>raster<span className="brand-dot">.</span></span>
        </Link>
        <nav className="main-nav" aria-label="Primary navigation">
          <Link href="/#offers">Compare offers</Link>
          <Link href="/how-it-works">How it works</Link>
          <Link href="/data-health" aria-current="page">Data health</Link>
        </nav>
        <span className="status-chip"><span className="status-dot" aria-hidden="true" /> {liveRead ? "d1 view" : "fixture view"}</span>
      </header>

      <section className="health-hero">
        <div>
          <p className="eyebrow"><span>05</span> / DATA HEALTH</p>
          <h1>Trust the signal.<br /><em>Know its state.</em></h1>
          <p>One compact view for what is real in the demo, what is still pending, and what the live pipeline must prove before it earns a green badge.</p>
        </div>
        <div className="health-stamp" aria-label="Live collectors not configured">
          <span className="stamp-ring" aria-hidden="true" />
          <strong>{liveRead ? <>D1 ROWS<br />READ</> : <>NO LIVE<br />RUN CLAIMED</>}</strong>
          <small>honesty is a feature</small>
        </div>
      </section>

      <section className="health-legend" aria-labelledby="health-legend-title">
        <div>
          <p className="eyebrow"><span>READ THIS FIRST</span> / EVIDENCE LEGEND</p>
          <h2 id="health-legend-title">What is live vs fixture?</h2>
        </div>
        <dl>
          <div>
            <dt>Current UI</dt>
            <dd><span className="legend-dot legend-fixture" aria-hidden="true" /> {liveRead ? "D1 normalized rows" : "fixture rows only"}</dd>
          </div>
          <div>
            <dt>Live provider</dt>
            <dd><span className="legend-dot legend-pending" aria-hidden="true" /> not configured</dd>
          </div>
          <div>
            <dt>Publish rule</dt>
            <dd><span className="legend-dot legend-policy" aria-hidden="true" /> same-ID rerun + schema validation</dd>
          </div>
          <div>
            <dt>Normalized rows</dt>
            <dd data-live-count={liveRead ? snapshot.liveOfferCount ?? 0 : "pending"}><span className={`legend-dot ${liveRead ? "legend-fixture" : "legend-pending"}`} aria-hidden="true" /> {liveRowsLabel}</dd>
          </div>
        </dl>
      </section>

      <section className="health-section" aria-labelledby="market-coverage-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow"><span>01</span> / MARKET COVERAGE</p>
            <h2 id="market-coverage-title">Four local views.</h2>
          </div>
          <p className="section-note">No FX conversion<br />No cross-market ranking</p>
        </div>
        <div className="market-health-grid">
          {marketHealth.map(({ market, tone, note }) => {
            const info = markets[market];
            return (
              <article className="market-health-card" key={market} data-health-tone={tone}>
                <div className="health-card-top">
                  <span className="health-icon" aria-hidden="true">{info.symbol}</span>
                  <span className="state-pill state-fixture">{liveRead ? "d1 ready" : "fixture ready"}</span>
                </div>
                <h3>{info.label}</h3>
                <p>Market-local offers only</p>
                <strong>{info.currency}</strong>
                <small>{liveRead ? "D1 row · observed timestamp shown per offer" : note}</small>
              </article>
            );
          })}
        </div>
      </section>

      <section className="health-section pipeline-section" aria-labelledby="pipeline-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow"><span>02</span> / PIPELINE READINESS</p>
            <h2 id="pipeline-title">Green means proven.</h2>
          </div>
          <p className="section-note">Pending states stay visible<br />until evidence exists</p>
        </div>
        <div className="pipeline-list">
          {displayedChecks.map((check) => (
            <article className="pipeline-row" key={check.key} data-status-key={check.key} data-health-tone={check.tone}>
              <span className={`pipeline-mark pipeline-${check.tone}`} aria-hidden="true">{check.tone === "ready" ? "✓" : "·"}</span>
              <div className="pipeline-copy">
                <h3>{check.label}</h3>
                <p>{check.detail}</p>
                <ul className="evidence-list" aria-label={`${check.label} evidence`}>
                  {check.evidence.map((evidence) => (
                    <li className={`evidence-chip evidence-chip-${evidence.kind}`} data-evidence-kind={evidence.kind} key={`${check.key}-${evidence.kind}-${evidence.label}`}>
                      {evidence.href ? <a href={evidence.href} target="_blank" rel="noreferrer">{evidence.label} ↗</a> : evidence.label}
                    </li>
                  ))}
                </ul>
              </div>
              <strong className={`pipeline-state pipeline-state-${check.tone}`}>{check.state}</strong>
            </article>
          ))}
        </div>
      </section>

      <section className="health-section evidence-section" aria-label="Eligibility and recovery evidence">
        <div className="evidence-card">
          <p className="eyebrow"><span>03</span> / ELIGIBILITY GATE</p>
          <h2>Long tail before live.</h2>
          <p>Before a collector is created, each retailer must pass the public-page and pre-built-coverage checks. This build intentionally shows the gate instead of inventing a collector ID.</p>
          <a className="button button-quiet" href="https://brightdata.com/products/scrapers" target="_blank" rel="noreferrer">Review Bright Data scraper library ↗</a>
        </div>
        <div className="evidence-card">
          <p className="eyebrow"><span>04</span> / RECOVERY CONTRACT</p>
          <h2>Last-known-good, then quarantine.</h2>
          <p>A failed refresh never silently replaces a known-good row. Keep the last valid snapshot visible with a stale label, quarantine malformed output, describe the failure, and only publish a healed rerun after schema checks pass.</p>
          <div className="recovery-flow" aria-label="Recovery sequence"><span>last good</span><b>→</b><span>quarantine</span><b>→</b><span>heal + validate</span></div>
        </div>
      </section>

      <footer className="site-footer">
        <Link href="/" className="brand"><span className="brand-mark" aria-hidden="true">R</span><span>raster<span className="brand-dot">.</span></span></Link>
        <span>{liveRead ? "D1 catalog health · provider run tracked separately" : "Fixture health · no live run claimed"}</span>
        <Link href="/#offers">Back to offers ↗</Link>
      </footer>
    </main>
  );
}
