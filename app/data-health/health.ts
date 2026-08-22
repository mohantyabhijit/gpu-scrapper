import type { MarketDefinition } from "../../config/markets";
import type { CatalogSnapshot } from "../../lib/postgres/catalog";

export type CatalogMarketRead = {
  readonly market: MarketDefinition;
  readonly snapshot: CatalogSnapshot;
};

export type CatalogHealthState = {
  readonly liveRead: boolean;
  readonly liveOfferCount: number;
  readonly liveMarketSlugs: readonly string[];
  readonly liveOfferCountsByMarket: ReadonlyMap<string, number>;
};

/** Aggregate independent market reads without allowing an empty default market to hide live rows elsewhere. */
export function aggregateCatalogHealth(reads: readonly CatalogMarketRead[]): CatalogHealthState {
  const liveOfferCountsByMarket = new Map<string, number>();
  for (const read of reads) {
    if (read.snapshot.source !== "postgres") continue;
    const count = read.snapshot.liveOfferCount ?? read.snapshot.offers.length;
    if (count <= 0) continue;
    liveOfferCountsByMarket.set(read.market.slug, count);
  }
  const liveMarketSlugs = [...liveOfferCountsByMarket.keys()];
  return {
    liveRead: liveMarketSlugs.length > 0,
    liveOfferCount: [...liveOfferCountsByMarket.values()].reduce((total, count) => total + count, 0),
    liveMarketSlugs,
    liveOfferCountsByMarket,
  };
}
