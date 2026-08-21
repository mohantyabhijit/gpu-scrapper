import Link from "next/link";
import { formatPrice, getMarket, markets } from "./catalog";
import { loadCatalog } from "../lib/d1/catalog";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function valueOf(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function Home({ searchParams }: { searchParams?: SearchParams }) {
  const params = searchParams ? await searchParams : {};
  const requestedMarket = getMarket(valueOf(params.market));
  const snapshot = await loadCatalog({ market: requestedMarket });
  const marketInfo = snapshot.selectedMarket ?? markets.us;
  const market = marketInfo.slug;
  const marketOffers = snapshot.offers.filter((offer) => offer.market === market && offer.currency === marketInfo.currency);
  const query = (valueOf(params.q) ?? "").trim().toLowerCase();
  const availability = valueOf(params.availability) ?? "all";
  const source = valueOf(params.source) ?? "all";
  const filteredOffers = marketOffers.filter((offer) => {
    const matchesQuery = !query || `${offer.model} ${offer.brand} ${offer.source}`.toLowerCase().includes(query);
    const matchesAvailability = availability === "all" || offer.availability.toLowerCase().replaceAll(" ", "-") === availability;
    const matchesSource = source === "all" || offer.source.toLowerCase().replaceAll(" ", "-") === source;
    return matchesQuery && matchesAvailability && matchesSource;
  });
  const lowest = [...marketOffers].sort((a, b) => a.price - b.price)[0];
  const sources = Array.from(new Set(marketOffers.map((offer) => offer.source)));
  const liveRead = snapshot.source === "d1";
  const catalogLabel = liveRead ? "D1 CATALOG" : "FIXTURE CATALOG";
  const catalogMessage = liveRead
    ? `${snapshot.liveOfferCount ?? marketOffers.length} normalized rows read from D1. Verify price and stock at the retailer.`
    : "Clearly labelled demo data for the hackathon build. Prices and stock are not live; verify at the retailer.";

  return <main className="site-shell">
    <div className="demo-banner" role="note"><span className="pulse-dot" aria-hidden="true" /><strong>{catalogLabel}</strong><span>{catalogMessage}</span></div>
    <header className="topbar"><Link href="/" className="brand"><span className="brand-mark" aria-hidden="true">R</span><span>raster<span className="brand-dot">.</span></span></Link><nav className="main-nav" aria-label="Primary navigation"><a href="#offers">Compare offers</a><Link href="/how-it-works">How it works</Link><Link href="/data-health">Data health</Link></nav><span className="status-chip"><span className="status-dot" aria-hidden="true" /> {liveRead ? "d1 view" : "fixture view"}</span></header>
    <section className="hero-section"><div className="hero-copy"><p className="eyebrow"><span>01</span> / MARKET SIGNAL</p><h1>The GPU market,<br /><em>without the tab circus.</em></h1><p className="hero-lede">Raster puts public GPU listing data into one calm, market-local view. Pick a market, then compare offers only in that currency.</p><div className="hero-actions"><a className="button button-primary" href="#offers">Find a GPU <span aria-hidden="true">↓</span></a><Link className="button button-quiet" href="/how-it-works">See the pipeline <span aria-hidden="true">↗</span></Link></div></div><div className="hero-visual" aria-label="Abstract GPU circuit illustration" role="img"><div className="visual-grid" /><div className="gpu-slab"><span>RTX</span><strong>50</strong><i /></div><div className="visual-label label-top">{liveRead ? "D1 / NORMALIZED ROWS" : "FIXTURE / PUBLIC LINKS"}</div><div className="visual-label label-bottom">MARKET-LOCAL CURRENCY</div></div></section>
    <section className="signal-strip" aria-label="Market-local signals"><div><span className="metric-label">ACTIVE MARKET</span><strong>{marketInfo.label}</strong><small>{marketInfo.currency} only</small></div><div><span className="metric-label">{liveRead ? "D1 ROWS SHOWN" : "FIXTURES SHOWN"}</span><strong>{marketOffers.length.toString().padStart(2, "0")}</strong><small> across {sources.length.toString().padStart(2, "0")} retailers</small></div><div><span className="metric-label">LOWEST {liveRead ? "D1 ROW" : "FIXTURE"}</span><strong>{lowest ? formatPrice(lowest.price, lowest.currency, marketInfo.locale) : "—"}</strong><small>{lowest ? `/ ${lowest.model.replace("GeForce ", "")}` : "No offers yet"}</small></div></section>
    <section className="offers-section" id="offers"><div className="section-heading"><div><p className="eyebrow"><span>02</span> / COMPARISON DESK</p><h2>Offers worth opening.</h2></div><p className="section-note">Market-local comparison · {marketInfo.label}<br />{liveRead ? "Observed timestamps shown per row" : "Fixture window: today"}</p></div>
      <form className="filter-bar" method="get" action="#offers"><label className="market-field"><span className="sr-only">Market</span><select name="market" defaultValue={market}>{snapshot.markets.map((item) => <option key={item.code} value={item.slug}>{item.label} · {item.currency}</option>)}</select></label><label className="search-field"><span aria-hidden="true">⌕</span><span className="sr-only">Search offers</span><input name="q" defaultValue={valueOf(params.q) ?? ""} placeholder="Search model, brand, retailer…" /></label><label><span className="sr-only">Availability</span><select name="availability" defaultValue={availability}><option value="all">All signals</option><option value="in-stock">In stock</option><option value="low-stock">Low stock</option><option value="stale-check">Stale check</option></select></label><label><span className="sr-only">Retailer</span><select name="source" defaultValue={source}><option value="all">All retailers</option>{sources.map((item) => <option key={item} value={item.toLowerCase().replaceAll(" ", "-")}>{item}</option>)}</select></label><button className="button filter-button" type="submit">Filter</button></form>
      <p className="market-boundary">Showing {marketInfo.label} only · no cross-market price ranking or currency conversion.</p><div className="filter-context" aria-live="polite"><span>{filteredOffers.length} offers</span> · <Link href={`/?market=${market}#offers`}>Reset filters</Link>{query && <span> · showing “{query}”</span>}</div>
      <div className="offer-grid">{filteredOffers.map((offer) => <article className="offer-card" key={offer.id}><div className="offer-topline"><span className={`signal signal-${offer.freshnessTone}`}><span /> {offer.availability}</span><span className="freshness">{offer.freshness}</span></div><div className="card-gpu-art" aria-hidden="true"><span>{offer.model.split(" ").at(-1)}</span><div /></div><div className="offer-content"><p className="offer-model">{offer.model}</p><h3>{offer.brand}</h3><p className="offer-spec">{offer.vram} <span>·</span> {marketInfo.label}</p><div className="offer-price-row"><strong>{formatPrice(offer.price, offer.currency, marketInfo.locale)}</strong><span className="collector-badge">{liveRead ? "live row" : "fixture offer"}</span></div><div className="offer-footer"><span className="source-name"><span className={`source-avatar source-${offer.source.toLowerCase().replaceAll(" ", "-")}`}>{offer.source.slice(0, 1)}</span>{offer.source}</span><span className="offer-actions"><Link href={`/gpu/${offer.modelSlug}?market=${market}`}>Compare details <span aria-hidden="true">→</span></Link><a href={offer.productUrl} target="_blank" rel="noreferrer">Verify at retailer <span aria-hidden="true">↗</span></a></span></div></div></article>)}</div>{filteredOffers.length === 0 && <div className="empty-state"><strong>No matching offers.</strong><p>Try a model name, retailer, or reset the filters.</p><Link className="button button-primary" href={`/?market=${market}#offers`}>Show all offers</Link></div>}</section>
    <section className="trust-section"><div><p className="eyebrow"><span>03</span> / A BETTER SIGNAL</p><h2>Every price has a paper trail.</h2></div><div className="trust-copy"><p>Raster keeps the source, market, currency, and {liveRead ? "observed timestamp" : "fixture label"} beside every offer. No made-up availability. No silent currency conversion. Just a short path from a public link to an informed click.</p><Link href="/how-it-works">Read the method <span aria-hidden="true">↗</span></Link></div></section>
    <footer className="site-footer"><Link href="/" className="brand"><span className="brand-mark" aria-hidden="true">R</span><span>raster<span className="brand-dot">.</span></span></Link><span>Market-local GPU comparison · Built for Into the Scrape-Verse</span><span>© 2026 Raster</span></footer>
  </main>;
}
