import Link from "next/link";
import { formatPrice, getMarket, markets, type Offer } from "./catalog";
import { loadCatalog } from "../lib/postgres/catalog";
import SourcingDesk, { SourceDeskAddButton, type SourceDeskOffer } from "../components/sourcing-desk";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
type FilterKey = "q" | "gpu" | "source" | "availability" | "sort";

function valuesOf(value: string | string[] | undefined) {
  return Array.from(new Set((Array.isArray(value) ? value : value ? [value] : []).map((item) => item.trim()).filter(Boolean)));
}

function valueOf(value: string | string[] | undefined) {
  return valuesOf(value)[0];
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function defaultOfferOrder(a: Offer, b: Offer) {
  const healthRank = { healthy: 0, fixture: 1, degraded: 2, unavailable: 3 };
  const freshnessRank = { fresh: 0, fixture: 1, aging: 2, stale: 3 };
  const availabilityRank = { "In stock": 0, "Low stock": 1, Unknown: 2, Unavailable: 3 };
  return healthRank[a.healthState] - healthRank[b.healthState]
    || freshnessRank[a.freshnessState] - freshnessRank[b.freshnessState]
    || availabilityRank[a.availability] - availabilityRank[b.availability]
    || Date.parse(b.observedAt) - Date.parse(a.observedAt)
    || a.price - b.price
    || a.id.localeCompare(b.id);
}

function buildFilterHref(market: string, params: URLSearchParams, key?: FilterKey, value?: string) {
  const next = new URLSearchParams(params);
  if (key) {
    if (key === "gpu" || key === "source") {
      const retained = next.getAll(key).filter((item) => item !== value);
      next.delete(key);
      retained.forEach((item) => next.append(key, item));
    } else {
      next.delete(key);
    }
  }
  next.set("market", market);
  return `/?${next.toString()}#offers`;
}

export default async function Home({ searchParams }: { searchParams?: SearchParams }) {
  const params = searchParams ? await searchParams : {};
  const requestedMarket = getMarket(valueOf(params.market));
  const snapshot = await loadCatalog({ market: requestedMarket });
  const catalogSnapshots = await Promise.all(snapshot.markets.map((item) => loadCatalog({ market: item.slug })));
  const safeCatalog = Array.from(new Map(catalogSnapshots.flatMap((item) => item.offers).map((offer) => [offer.id, offer])).values());
  const marketInfo = snapshot.selectedMarket ?? markets.us;
  const market = marketInfo.slug;
  const marketOffers = snapshot.offers.filter((offer) => offer.market === market && offer.currency === marketInfo.currency);
  const queryText = (valueOf(params.q) ?? "").trim();
  const query = queryText.toLowerCase();
  const availabilityOptions = ["in-stock", "low-stock", "unavailable", "unknown"];
  const availability = availabilityOptions.includes(valueOf(params.availability) ?? "") ? valueOf(params.availability)! : "all";
  const sortOptions = ["recommended", "price-low", "price-high", "freshness"];
  const sort = sortOptions.includes(valueOf(params.sort) ?? "") ? valueOf(params.sort)! : "recommended";
  const modelOptions = Array.from(new Map(marketOffers.map((offer) => [offer.modelSlug, offer.model])).entries()).sort((a, b) => a[1].localeCompare(b[1]));
  const sourceOptions = Array.from(new Map(marketOffers.map((offer) => [slugify(offer.source), offer.source])).entries()).sort((a, b) => a[1].localeCompare(b[1]));
  const validModels = new Set(modelOptions.map(([slug]) => slug));
  const validSources = new Set(sourceOptions.map(([slug]) => slug));
  const selectedModels = valuesOf(params.gpu).filter((slug) => validModels.has(slug));
  const selectedSources = valuesOf(params.source).filter((slug) => validSources.has(slug));
  const filteredOffers = marketOffers.filter((offer) => {
    const matchesQuery = !query || `${offer.model} ${offer.brand} ${offer.source}`.toLowerCase().includes(query);
    const matchesAvailability = availability === "all" || slugify(offer.availability) === availability;
    const matchesModel = selectedModels.length === 0 || selectedModels.includes(offer.modelSlug);
    const matchesSource = selectedSources.length === 0 || selectedSources.includes(slugify(offer.source));
    return matchesQuery && matchesAvailability && matchesModel && matchesSource;
  }).sort((a, b) => {
    if (sort === "price-low") return a.price - b.price || defaultOfferOrder(a, b);
    if (sort === "price-high") return b.price - a.price || defaultOfferOrder(a, b);
    if (sort === "freshness") return Date.parse(b.observedAt) - Date.parse(a.observedAt) || defaultOfferOrder(a, b);
    return defaultOfferOrder(a, b);
  });
  const purchasableOffers = marketOffers.filter((offer) => offer.availability === "In stock" || offer.availability === "Low stock");
  const lowest = [...purchasableOffers].sort((a, b) => a.price - b.price || defaultOfferOrder(a, b))[0];
  const sources = Array.from(new Set(marketOffers.map((offer) => offer.source)));
  const liveRead = snapshot.source === "postgres";
  const catalogLabel = liveRead ? "POSTGRESQL CATALOG" : "FIXTURE CATALOG";
  const catalogMessage = liveRead
    ? `${snapshot.liveOfferCount ?? marketOffers.length} normalized rows read from hosted PostgreSQL via private Hyperdrive. Verify price and stock at the retailer.`
    : "Clearly labelled demo data for the hackathon build. Prices and stock are not live; verify at the retailer.";
  const activeParams = new URLSearchParams();
  if (queryText) activeParams.set("q", queryText);
  selectedModels.forEach((item) => activeParams.append("gpu", item));
  selectedSources.forEach((item) => activeParams.append("source", item));
  if (availability !== "all") activeParams.set("availability", availability);
  if (sort !== "recommended") activeParams.set("sort", sort);
  const activeFilters = [
    ...(queryText ? [{ key: "q" as const, value: queryText, label: `Search: ${queryText}` }] : []),
    ...selectedModels.map((value) => ({ key: "gpu" as const, value, label: modelOptions.find(([slug]) => slug === value)?.[1] ?? value })),
    ...selectedSources.map((value) => ({ key: "source" as const, value, label: sourceOptions.find(([slug]) => slug === value)?.[1] ?? value })),
    ...(availability !== "all" ? [{ key: "availability" as const, value: availability, label: availability.replaceAll("-", " ") }] : []),
    ...(sort !== "recommended" ? [{ key: "sort" as const, value: sort, label: `Sort: ${sort.replaceAll("-", " ")}` }] : []),
  ];
  const sourceDeskOffers = safeCatalog.map(({ id, market: offerMarket, model, brand, source, currency, price, availability, observedAt, healthState, freshness, productUrl }): SourceDeskOffer => ({ id, market: offerMarket, model, brand, source, currency, price, availability, observedAt, healthState, freshness, productUrl }));
  const sourceDeskCatalogBlob = btoa(JSON.stringify(sourceDeskOffers));

  return <main className="site-shell">
    <div className="demo-banner" role="note"><span className="pulse-dot" aria-hidden="true" /><strong>{catalogLabel}</strong><span>{catalogMessage}</span></div>
    <header className="topbar"><Link href="/" className="brand"><span className="brand-mark" aria-hidden="true">R</span><span>raster<span className="brand-dot">.</span></span></Link><nav className="main-nav" aria-label="Primary navigation"><a href="#offers">Compare offers</a><Link href="/how-it-works">How it works</Link><Link href="/data-health">Data health</Link></nav><span className="status-chip"><span className="status-dot" aria-hidden="true" /> {liveRead ? "postgres view" : "fixture view"}</span></header>
    <section className="hero-section"><div className="hero-copy"><p className="eyebrow"><span>01</span> / MARKET SIGNAL</p><h1>The GPU market,<br /><em>without the tab circus.</em></h1><p className="hero-lede">Raster puts public GPU listing data into one calm, market-local view. Pick a market, then compare offers only in that currency.</p><div className="hero-actions"><a className="button button-primary" href="#offers">Find a GPU <span aria-hidden="true">↓</span></a><Link className="button button-quiet" href="/how-it-works">See the pipeline <span aria-hidden="true">↗</span></Link></div></div><div className="hero-visual" aria-label="Abstract GPU circuit illustration" role="img"><div className="visual-grid" /><div className="gpu-slab"><span>RTX</span><strong>50</strong><i /></div><div className="visual-label label-top">{liveRead ? "POSTGRESQL / NORMALIZED ROWS" : "FIXTURE / PUBLIC LINKS"}</div><div className="visual-label label-bottom">MARKET-LOCAL CURRENCY</div></div></section>
    <section className="signal-strip" aria-label="Market-local signals"><div><span className="metric-label">ACTIVE MARKET</span><strong>{marketInfo.label}</strong><small>{marketInfo.currency} only</small></div><div><span className="metric-label">{liveRead ? "POSTGRESQL ROWS SHOWN" : "FIXTURES SHOWN"}</span><strong>{marketOffers.length.toString().padStart(2, "0")}</strong><small> across {sources.length.toString().padStart(2, "0")} retailers</small></div><div><span className="metric-label">LOWEST AVAILABLE {liveRead ? "ROW" : "FIXTURE"}</span><strong>{lowest ? formatPrice(lowest.price, lowest.currency, marketInfo.locale) : "—"}</strong><small>{lowest ? `/ ${lowest.model.replace("GeForce ", "")}` : "No available offers"}</small></div></section>
    <section className="offers-section" id="offers"><div className="section-heading"><div><p className="eyebrow"><span>02</span> / COMPARISON DESK</p><h2>Offers worth opening.</h2></div><p className="section-note">Market-local comparison · {marketInfo.label}<br />{liveRead ? "Exact observed timestamps per row" : "Explicit fixture timestamps"}</p></div>
      <form className="filter-bar" method="get" action="#offers"><div className="filter-primary"><label className="market-field"><span>Market</span><select name="market" defaultValue={market}>{snapshot.markets.map((item) => <option key={item.code} value={item.slug}>{item.label} · {item.currency}</option>)}</select></label><label className="search-field"><span>Search</span><input name="q" defaultValue={queryText} placeholder="Model, brand, retailer…" /></label><label><span>Availability</span><select name="availability" defaultValue={availability}><option value="all">All signals</option><option value="in-stock">In stock</option><option value="low-stock">Low stock</option><option value="unavailable">Unavailable</option><option value="unknown">Unknown</option></select></label><label><span>Sort</span><select name="sort" defaultValue={sort}><option value="recommended">Recommended</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option><option value="freshness">Newest observed</option></select></label></div><div className="filter-groups"><fieldset><legend>GPU families</legend><div className="check-group">{modelOptions.map(([slug, label]) => <label key={slug}><input type="checkbox" name="gpu" value={slug} defaultChecked={selectedModels.includes(slug)} /><span>{label.replace("GeForce ", "")}</span></label>)}</div></fieldset><fieldset><legend>Retailers</legend><div className="check-group">{sourceOptions.map(([slug, label]) => <label key={slug}><input type="checkbox" name="source" value={slug} defaultChecked={selectedSources.includes(slug)} /><span>{label}</span></label>)}</div></fieldset><button className="button filter-button" type="submit">Apply filters</button></div></form>
      <p className="market-boundary">Showing {marketInfo.label} only · no cross-market price ranking or currency conversion.</p>{activeFilters.length > 0 && <div className="active-filters" aria-label="Active filters"><span>Active:</span>{activeFilters.map((filter) => <Link className="filter-chip" key={`${filter.key}-${filter.value}`} href={buildFilterHref(market, activeParams, filter.key, filter.value)}>{filter.label}<span aria-hidden="true"> ×</span><span className="sr-only"> remove filter</span></Link>)}<Link className="clear-filters" href={`/?market=${market}#offers`}>Clear all</Link></div>}<div className="filter-context" aria-live="polite"><span>{filteredOffers.length} {filteredOffers.length === 1 ? "offer" : "offers"}</span>{queryText && <span> · showing “{queryText}”</span>}</div>
      <SourcingDesk catalogBlob={sourceDeskCatalogBlob} marketLabel={marketInfo.label} fixture={!liveRead}><div className="offer-grid">{filteredOffers.map((offer) => <article className="offer-card" key={offer.id}><div className="offer-topline"><span className={`signal signal-${offer.freshnessTone}`}><span /> {offer.availability}</span><time className="freshness" dateTime={offer.observedAt}>{offer.freshness}</time></div><div className="card-gpu-art" aria-hidden="true"><span>{offer.model.split(" ").at(-1)}</span><div /></div><div className="offer-content"><p className="offer-model">{offer.model}</p><h3>{offer.brand}</h3><p className="offer-spec">{offer.vram} <span>·</span> {marketInfo.label}</p><div className="offer-price-row"><strong>{formatPrice(offer.price, offer.currency, marketInfo.locale)}</strong><span className={`collector-badge health-${offer.healthState}`}>{liveRead ? `${offer.healthState} source` : "fixture source"}</span></div><SourceDeskAddButton offer={sourceDeskOffers.find((item) => item.id === offer.id)!} /><div className="offer-footer"><span className="source-name"><span className={`source-avatar source-${slugify(offer.source)}`}>{offer.source.slice(0, 1)}</span>{offer.source}</span><span className="offer-actions"><Link href={`/gpu/${offer.modelSlug}?market=${market}`}>Compare details <span aria-hidden="true">→</span></Link><a href={offer.productUrl} target="_blank" rel="noreferrer">Verify at retailer <span aria-hidden="true">↗</span></a></span></div></div></article>)}</div>{filteredOffers.length === 0 && <div className="empty-state"><strong>No matching offers.</strong><p>Try another model, retailer, or clear the active filters.</p><Link className="button button-primary" href={`/?market=${market}#offers`}>Show all offers</Link></div>}</SourcingDesk></section>
    <section className="trust-section"><div><p className="eyebrow"><span>03</span> / A BETTER SIGNAL</p><h2>Every price has a paper trail.</h2></div><div className="trust-copy"><p>Raster keeps availability, source health, freshness, market, currency, and the exact {liveRead ? "observed time" : "fixture time"} beside every offer. No made-up availability. No silent currency conversion.</p><Link href="/how-it-works">Read the method <span aria-hidden="true">↗</span></Link></div></section>
    <footer className="site-footer"><Link href="/" className="brand"><span className="brand-mark" aria-hidden="true">R</span><span>raster<span className="brand-dot">.</span></span></Link><span>Market-local GPU comparison · Built for Into the Scrape-Verse</span><span>© 2026 Raster</span></footer>
  </main>;
}
