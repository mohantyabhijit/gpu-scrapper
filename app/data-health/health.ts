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

export type MarketCatalogHealth = {
  readonly hasLiveRows: boolean;
  readonly tone: "ready" | "pending" | "planned";
  readonly note: string;
};

export type SchedulerHealth = {
  readonly state: "Pending · not configured" | "Configured · signed workflow";
  readonly tone: "pending" | "ready";
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

export function marketCatalogHealth(state: CatalogHealthState, market: MarketDefinition): MarketCatalogHealth {
  const hasLiveRows = state.liveOfferCountsByMarket.has(market.slug);
  return {
    hasLiveRows,
    tone: market.ready === false ? "pending" : hasLiveRows ? "ready" : "planned",
    note: hasLiveRows ? "PostgreSQL row · observed timestamp shown per offer" : "Fixture rows only · no live normalized rows for this market",
  };
}

export function schedulerHealth(workflowEvidenceVerified: boolean): SchedulerHealth {
  return workflowEvidenceVerified
    ? { state: "Configured · signed workflow", tone: "ready" }
    : { state: "Pending · not configured", tone: "pending" };
}
