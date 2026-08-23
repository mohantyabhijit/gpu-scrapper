import Link from "../../components/app-link";
import type { MarketDefinition } from "../../config/markets";
import { loadCatalog, loadHealingEvidence } from "../../lib/postgres/catalog";
import { HEALING_STAGES, type HealingStage } from "../../lib/postgres/healing-evidence";
import { aggregateCatalogHealth, marketCatalogHealth, schedulerHealth } from "./health";
import { studioCollectors, studioCollectorUrl } from "../../config/studio-collectors";

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
  readonly market: MarketDefinition;
  readonly tone: HealthTone;
  readonly note: string;
};

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
    detail: "Contract break → quarantine → heal preview → approval → rerun. The catalog changes only after the same Collector ID and a valid post-heal contract are evidenced.",
    evidence: [
      { kind: "policy", label: "Policy: same-ID repair" },
      { kind: "fixture", label: "Evidence required" },
    ],
  },
];

const healingLabels: Record<HealingStage, string> = {
  healthy: "healthy run",
  broken: "contract break",
  quarantined: "quarantined",
  previewed: "heal preview",
  approved: "approved",
  rerun: "same-ID rerun",
  published: "published",
};

const healingTime = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "UTC",
});

export default async function DataHealth() {
  const [snapshot, healing] = await Promise.all([loadCatalog(), loadHealingEvidence()]);
  const catalogReads = await Promise.all(snapshot.markets.map(async (market) => ({
    market,
    snapshot: market.slug === snapshot.selectedMarket.slug ? snapshot : await loadCatalog({ market: market.slug }),
  })));
  const catalogHealth = aggregateCatalogHealth(catalogReads);
  const liveRead = catalogHealth.liveRead;
  const schedulerState = schedulerHealth(false);
  const liveRowsLabel = liveRead
    ? `${catalogHealth.liveOfferCount} normalized PostgreSQL rows`
    : snapshot.fallbackReason === "database-empty"
      ? "pending · no normalized rows"
      : "pending · DB read unavailable";
  const withCatalogState: readonly HealthCheck[] = liveRead ? pipelineChecks.map((check) => {
    if (check.key === "fixture-catalog") {
      return {
        ...check,
        label: "PostgreSQL normalized offers",
        state: `${catalogHealth.liveOfferCount} rows read`,
        detail: "Rows passed the market, currency, source, URL, and timestamp checks before entering the storefront.",
        evidence: [
          { kind: "provider", label: "PostgreSQL read" },
          { kind: "policy", label: "Schema validated" },
        ],
      };
    }
    if (check.key === "live-collectors") {
      return {
        ...check,
        state: `${catalogHealth.liveMarketSlugs.length} market(s) observed`,
        tone: "ready",
        detail: "Normalized PostgreSQL rows are present for the listed markets; provider execution remains a separate evidence boundary.",
        evidence: [
          { kind: "provider", label: "Live rows observed" },
          { kind: "policy", label: "Source-bound contract" },
        ],
      };
    }
    if (check.key === "scheduler-trigger") return { ...check, ...schedulerState };
    return check;
  }) : pipelineChecks;
  const displayedChecks: readonly HealthCheck[] = withCatalogState.map((check) => check.key === "self-heal" && healing
    ? {
      ...check,
      state: healing.complete ? "Recorded · same ID" : `${healing.events.length}/7 stages recorded`,
      tone: "pending",
      detail: healing.complete
        ? `The operator ledger records a full sequence on ${healing.sourceSlug} without changing Collector ${healing.collectorId}; provider attestation is still required before this becomes proof.`
        : `Append-only evidence has reached ${healingLabels[healing.events.at(-1)!.stage]}; ${healing.nextStage ? healingLabels[healing.nextStage] : "completion"} is next.`,
      evidence: [
        { kind: "provider", label: healing.collectorId },
        { kind: "policy", label: healing.complete ? "7/7 events recorded" : `${healing.events.length}/7 stages` },
      ],
    }
    : check);
  const marketHealth: readonly (MarketHealth & { readonly hasLiveRows: boolean })[] = snapshot.markets.map((market) => ({
    market,
    ...marketCatalogHealth(catalogHealth, market),
  }));
  return (
    <main className="site-shell health-page">
      <div className="demo-banner" role="note">
        <span className="pulse-dot" aria-hidden="true" />
        <strong>{liveRead ? "POSTGRESQL NORMALIZED READ" : "FIXTURE CATALOG"}</strong>
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
        <span className="status-chip"><span className="status-dot" aria-hidden="true" /> {liveRead ? "postgres view" : "fixture view"}</span>
      </header>

      <section className="health-hero">
        <div>
          <p className="eyebrow"><span>05</span> / DATA HEALTH</p>
          <h1>Trust the signal.<br /><em>Know its state.</em></h1>
          <p>One compact view for what is real in the demo, what is still pending, and what the live pipeline must prove before it earns a green badge.</p>
        </div>
        <div className="health-stamp" aria-label={liveRead ? "Normalized PostgreSQL rows are available; provider proof is tracked separately" : "Live collectors not configured"}>
          <span className="stamp-ring" aria-hidden="true" />
          <strong>{liveRead ? <>POSTGRESQL ROWS<br />READ</> : <>NO LIVE<br />RUN CLAIMED</>}</strong>
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
            <dd><span className="legend-dot legend-fixture" aria-hidden="true" /> {liveRead ? "PostgreSQL normalized rows" : "fixture rows only"}</dd>
          </div>
          <div>
            <dt>Live provider</dt>
            <dd><span className={`legend-dot ${liveRead ? "legend-fixture" : "legend-pending"}`} aria-hidden="true" /> {liveRead ? "normalized rows observed" : "not configured"}</dd>
          </div>
          <div>
            <dt>Publish rule</dt>
            <dd><span className="legend-dot legend-policy" aria-hidden="true" /> same-ID rerun + schema validation</dd>
          </div>
          <div>
            <dt>Normalized rows</dt>
            <dd data-live-count={liveRead ? catalogHealth.liveOfferCount : "pending"}><span className={`legend-dot ${liveRead ? "legend-fixture" : "legend-pending"}`} aria-hidden="true" /> {liveRowsLabel}</dd>
          </div>
        </dl>
      </section>

      <section className="health-section" aria-labelledby="onboarding-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow"><span>00</span> / COUNTRY PACKS</p>
            <h2 id="onboarding-title">Markets earn their place.</h2>
          </div>
          <p className="section-note">Eligibility → collector → contract<br />Only ready packs enter the selector</p>
        </div>
        {snapshot.marketPacks.length === 0 ? <div className="empty-state" role="status"><strong>No runtime Country Pack recorded.</strong><p>{snapshot.fallbackReason === "database-unavailable" ? "The PostgreSQL pack ledger is unavailable in this view." : "Submit an authenticated pending pack to begin the evidence-gated demo."}</p></div> : <div className="market-health-grid">
          {snapshot.marketPacks.map((market) => {
            const gates = [
              ["eligibility", market.eligibilityProven],
              ["collector created", market.collectorCreatedProven],
              ["collector run", market.collectorRunProven],
            ] as const;
            const missing = gates.filter(([, proven]) => !proven).map(([label]) => label);
            return (
            <article className="market-health-card" key={market.slug} data-health-tone={market.ready === false ? "pending" : "ready"}>
              <div className="health-card-top"><span className="health-icon" aria-hidden="true">{market.symbol}</span><span className={`state-pill ${market.ready === false ? "state-pending" : "state-fixture"}`}>{market.ready === false ? "evidence pending" : "ready pack"}</span></div>
              <h3>{market.label}</h3><p>{market.code} · {market.currency} · {market.sourceDisplayName ?? "starter retailer"}</p>
              <ul className="evidence-list" aria-label={`${market.label} admission gates`}>{gates.map(([label, proven]) => <li className={`evidence-chip evidence-chip-${proven ? "policy" : "fixture"}`} key={label}>{proven ? "✓" : "·"} {label}</li>)}</ul>
              <small>{missing.length > 0 ? `Still required: ${missing.join(", ")}.` : "All admission gates proved; this pack can enter the selector."}</small>
            </article>
          );})}
        </div>}
      </section>

      <section className="health-section" aria-labelledby="market-coverage-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow"><span>01</span> / MARKET COVERAGE</p>
            <h2 id="market-coverage-title">{snapshot.markets.length} local views.</h2>
          </div>
          <p className="section-note">No FX conversion<br />No cross-market ranking</p>
        </div>
        <div className="market-health-grid">
          {marketHealth.map(({ market: info, hasLiveRows, tone, note }) => {
            return (
              <article className="market-health-card" key={info.slug} data-health-tone={tone}>
                <div className="health-card-top">
                  <span className="health-icon" aria-hidden="true">{info.symbol}</span>
                  <span className={`state-pill ${tone === "pending" ? "state-pending" : "state-fixture"}`}>{tone === "pending" ? "onboarding pending" : hasLiveRows ? "postgres ready" : "fixture ready"}</span>
                </div>
                <h3>{info.label}</h3>
                <p>Market-local offers only</p>
                <strong>{info.currency}</strong>
                <small>{note}</small>
              </article>
            );
          })}
        </div>
      </section>

      <section className="health-section" id="scraper-studio" aria-labelledby="studio-coverage-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow"><span>02</span> / SCRAPER STUDIO</p>
            <h2 id="studio-coverage-title">Collectors, not claims.</h2>
          </div>
          <p className="section-note">One fixed public retailer target per collector<br />Pilots stay out of the catalog until validated</p>
        </div>
        <div className="studio-collector-grid">
          {studioCollectors.map((collector) => (
            <article className="studio-collector-card" key={collector.collectorId} data-collector-state={collector.state}>
              <div className="studio-collector-topline">
                <span>{collector.category}</span>
                <strong>{collector.state === "production" ? "Production" : collector.state === "validated" ? "Validated pilot" : collector.state === "repairing" ? "Repairing" : "Studio pilot"}</strong>
              </div>
              <h3>{collector.retailer}</h3>
              <p>{collector.note}</p>
              <dl>
                <div><dt>Collector</dt><dd>{collector.collectorId}</dd></div>
                <div><dt>Template</dt><dd>{collector.name}</dd></div>
              </dl>
              <div className="studio-collector-links">
                <a href={studioCollectorUrl(collector.collectorId)} target="_blank" rel="noreferrer">Open in Studio ↗</a>
                <a href={collector.targetUrl} target="_blank" rel="noreferrer">Public target ↗</a>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="health-section" aria-labelledby="heal-timeline-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow"><span>02</span> / SAME-ID SELF-HEAL</p>
            <h2 id="heal-timeline-title">A recovery judges can inspect.</h2>
          </div>
          <p className="section-note">Collector ID must remain unchanged<br />{healing ? `${healing.events.length}/7 immutable stages recorded` : "Evidence pending until the live rehearsal"}</p>
        </div>
        <div className="evidence-card" data-status-key="self-heal-timeline" data-health-tone={healing?.complete ? "ready" : "pending"}>
          <ol className="heal-timeline" aria-label="Self-healing evidence timeline">
            {HEALING_STAGES.map((stage, index) => {
              const event = healing?.events[index];
              const current = !healing?.complete && healing?.nextStage === stage;
              return (
                <li key={stage} className={event ? "heal-stage-recorded" : "heal-stage-pending"} {...(current ? { "aria-current": "step" as const } : {})}>
                  <strong>{event ? "✓" : index + 1}</strong> {healingLabels[stage]}
                  {event ? <small>{healingTime.format(new Date(event.occurredAt))} UTC</small> : null}
                </li>
              );
            })}
          </ol>
          {healing ? (
            <div className="heal-proof-summary">
              <p><strong>{healing.complete ? "Operator timeline complete; provider proof pending." : "Live rehearsal in progress."}</strong> Source <code>{healing.sourceSlug}</code> remains bound to <code>{healing.collectorId}</code> across every recorded stage. A verified provider attestation and artifact hashes are required before Raster calls this proved.</p>
              <dl>
                <div><dt>Session</dt><dd>{healing.sessionId}</dd></div>
                <div><dt>Collector</dt><dd>{healing.collectorId}</dd></div>
                <div><dt>Evidence</dt><dd>{healing.events.length}/7 immutable stages</dd></div>
              </dl>
            </div>
          ) : <p><strong>Current evidence state: pending.</strong> Raster will only mark this green when pre-break, heal, and post-heal artifacts prove the same <code>c_*</code> Collector ID, a valid output contract, and no downstream code change.</p>}
        </div>
      </section>

      <section className="health-section pipeline-section" aria-labelledby="pipeline-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow"><span>03</span> / PIPELINE READINESS</p>
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
        <span>{liveRead ? "PostgreSQL catalog health · provider run tracked separately" : "Fixture health · no live run claimed"}</span>
        <Link href="/#offers">Back to offers ↗</Link>
      </footer>
    </main>
  );
}
