export type StudioCollectorState = "production" | "generated" | "validated" | "repairing";

export type StudioCollector = {
  readonly name: string;
  readonly category: "GPU" | "RAM" | "Mac mini" | "DGX Spark";
  readonly retailer: string;
  readonly collectorId: `c_${string}`;
  readonly targetUrl: string;
  readonly state: StudioCollectorState;
  readonly note: string;
};

/**
 * Public Scraper Studio inventory for Raster. This is presentation metadata,
 * not an ingestion allowlist: production triggering remains source-bound in
 * config/sources.ts and the protected refresh route.
 */
export const studioCollectors: readonly StudioCollector[] = [
  {
    name: "raster-sg-dynacore-gpus",
    category: "GPU",
    retailer: "Dynacore Technologies",
    collectorId: "c_mt3qzv5p215cci1r2e",
    targetUrl: "https://dynacoretech.com/collections/gpu",
    state: "production",
    note: "Enabled in the signed refresh pipeline.",
  },
  {
    name: "raster-sg-pc-themes-gpus",
    category: "GPU",
    retailer: "PC Themes",
    collectorId: "c_mt3zqdljej45v0g1r",
    targetUrl: "https://www.pcthemes.com.sg/video-card-graphics-card",
    state: "production",
    note: "Enabled in the signed refresh pipeline; same-ID healing proved.",
  },
  {
    name: "raster-sg-dynacore-ram",
    category: "RAM",
    retailer: "Dynacore Technologies",
    collectorId: "c_mt5h2qen1bkc7nbywu",
    targetUrl: "https://dynacoretech.com/collections/ram",
    state: "generated",
    note: "Studio pilot; excluded from the shopper catalog until validation passes.",
  },
  {
    name: "raster-sg-istudio-mac-mini",
    category: "Mac mini",
    retailer: "iStudio Singapore",
    collectorId: "c_mt5h72hcow8slxb6t",
    targetUrl: "https://www.istudiosg.com/collections/mac-mini",
    state: "repairing",
    note: "Studio pilot; initial AI generation failed and same-ID repair is in progress.",
  },
  {
    name: "raster-sg-dynacore-dgx-spark",
    category: "DGX Spark",
    retailer: "Dynacore Technologies",
    collectorId: "c_mt5hxrzckttss9n11",
    targetUrl: "https://dynacoretech.com/products/nvidia-dgx-spark-ai-supercomputer-128gb-ddr5x-4tb-nvidia-gb10-grace-blackwell-dgx-os-810152850381",
    state: "validated",
    note: "Same-ID healed Studio pilot; 1/1 public product row passed strict validation.",
  },
] as const;

export function studioCollectorUrl(collectorId: StudioCollector["collectorId"]) {
  return `https://brightdata.com/cp/scrapers/${collectorId}`;
}
