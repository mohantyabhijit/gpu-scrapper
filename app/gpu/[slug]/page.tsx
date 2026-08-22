import Link from "../../../components/app-link";
import { formatPrice as formatCurrencyPrice, getMarket, isRankableCatalogOffer, markets, models, type Currency } from "../../catalog";
import { loadCatalog } from "../../../lib/postgres/catalog";

export function generateStaticParams() {
  return models.map((model) => ({ slug: model.slug }));
}

export const dynamicParams = true;

export default async function GpuDetail({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const { slug } = await params;
  const query = searchParams ? await searchParams : {};
  const requestedMarket = getMarket(Array.isArray(query.market) ? query.market[0] : query.market);
  const snapshot = await loadCatalog({ market: requestedMarket, modelSlug: slug });
  const marketInfo = snapshot.selectedMarket ?? markets.us;
  const market = marketInfo.slug;
  const formatPrice = (price: number, currency: Currency) => formatCurrencyPrice(price, currency, marketInfo.locale);
  const modelOffers = snapshot.offers.filter((offer) => offer.modelSlug === slug && offer.market === market && offer.currency === marketInfo.currency);
  const fixtureModel = models.find((item) => item.slug === slug);
  const model = fixtureModel ?? (modelOffers[0] ? { slug, name: modelOffers[0].model, vram: modelOffers[0].vram } : undefined);
  const liveRead = snapshot.source === "postgres";
  if (!model || modelOffers.length === 0) return <main className="site-shell empty-route"><Link href="/" className="brand"><span className="brand-mark" aria-hidden="true">R</span><span>raster<span className="brand-dot">.</span></span></Link><h1>No {marketInfo.label} offer for that GPU.</h1><p>This market is enabled, but no normalized offer has been published for this model yet. Raster does not substitute another country’s rows.</p><Link className="button button-primary" href={`/?market=${market}`}>Back to {marketInfo.label}</Link></main>;
  const purchasableOffers = modelOffers.filter(isRankableCatalogOffer);
  const lowest = [...purchasableOffers].sort((a, b) => a.price - b.price)[0];
  const catalogLabel = liveRead ? "POSTGRESQL CATALOG" : "FIXTURE CATALOG";
  const catalogMessage = liveRead ? "Normalized hosted PostgreSQL rows via private Hyperdrive · verify every price and stock claim at the retailer." : "Demo data only · verify every price and stock claim at the retailer.";
  return <main className="site-shell detail-page"><div className="demo-banner" role="note"><span className="pulse-dot" aria-hidden="true" /><strong>{catalogLabel}</strong><span>{catalogMessage}</span></div><header className="topbar"><Link href="/" className="brand"><span className="brand-mark" aria-hidden="true">R</span><span>raster<span className="brand-dot">.</span></span></Link><nav className="main-nav" aria-label="Primary navigation"><Link href={`/?market=${market}#offers`}>Compare offers</Link><Link href="/how-it-works">How it works</Link><Link href="/data-health">Data health</Link></nav><span className="status-chip"><span className="status-dot" aria-hidden="true" /> {liveRead ? "postgres view" : "fixture view"}</span></header><div className="breadcrumbs"><Link href={`/?market=${market}`}>Raster · {marketInfo.label}</Link><span>/</span><span>{model.name}</span></div><section className="detail-hero"><div className="detail-art card-gpu-art"><span>{model.name.split(" ").at(-1)}</span><div /></div><div><p className="eyebrow"><span>{liveRead ? "MODEL DATA" : "MODEL FIXTURE"}</span> / {modelOffers.length} LOCAL SOURCES</p><h1>{model.name}</h1><p className="detail-spec">{model.vram} · {marketInfo.label} · {marketInfo.currency} comparison</p><div className="detail-price">{lowest ? <><span>{liveRead ? "Lowest current normalized offer in this market" : "Lowest available fixture in this market"}</span><strong>{formatPrice(lowest.price, lowest.currency)}</strong><small>{lowest.source} · <time dateTime={lowest.observedAt}>{lowest.freshness}</time></small></> : <><span>No currently purchasable offer</span><strong>—</strong><small>Review the observed rows below and verify availability at the retailer.</small></>}</div></div></section><section className="detail-offers" aria-label={`${model.name} ${marketInfo.label} ${liveRead ? "normalized rows" : "fixtures"}`}><div className="section-heading"><div><p className="eyebrow"><span>OFFER LEDGER</span> / MARKET-LOCAL</p><h2>Compare board partners.</h2></div><p className="section-note">No cross-market ranking<br />No currency conversion</p></div><div className="detail-table">{modelOffers.map((offer) => <div className="detail-row" key={offer.id}><div><strong>{offer.brand}</strong><span>{offer.source} · {offer.vram}</span></div><div className="detail-signal"><span className={`signal signal-${offer.freshnessTone}`}><span /> {offer.availability}</span><small>Source health: {offer.healthState}</small><small><time dateTime={offer.observedAt}>{offer.freshness}</time></small></div><strong className="detail-row-price">{formatPrice(offer.price, offer.currency)}</strong><a href={offer.productUrl} target="_blank" rel="noreferrer">Verify ↗</a></div>)}</div></section><footer className="site-footer"><Link href={`/?market=${market}`} className="brand"><span className="brand-mark" aria-hidden="true">R</span><span>raster<span className="brand-dot">.</span></span></Link><span>{liveRead ? "PostgreSQL normalized snapshot · verify before purchase" : "Fixture snapshot · verify before purchase"}</span><Link href="/how-it-works">How it works ↗</Link></footer></main>;
}
