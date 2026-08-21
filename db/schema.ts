import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const marketCurrencyCheck = (name: string) =>
  check(name, sql`(market = 'US' AND currency = 'USD')
    OR (market = 'UK' AND currency = 'GBP')
    OR (market = 'IN' AND currency = 'INR')
    OR (market = 'SG' AND currency = 'SGD')`);

export const sources = sqliteTable("sources", {
  slug: text("slug").primaryKey(),
  displayName: text("display_name").notNull(),
  market: text("market").notNull(),
  region: text("region").notNull(),
  currency: text("currency").notNull(),
  baseUrl: text("base_url").notNull(),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, () => [marketCurrencyCheck("sources_market_currency_check")]);

export const products = sqliteTable("products", {
  identityKey: text("identity_key").primaryKey(),
  slug: text("slug").notNull().unique(),
  gpuFamily: text("gpu_family").notNull(),
  model: text("model").notNull(),
  boardPartner: text("board_partner"),
  vramGb: integer("vram_gb"),
  mpn: text("mpn"),
  searchText: text("search_text").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [index("products_search_idx").on(table.searchText)]);

export const offers = sqliteTable("offers", {
  offerKey: text("offer_key").primaryKey(),
  productIdentityKey: text("product_identity_key").notNull().references(() => products.identityKey),
  sourceSlug: text("source_slug").notNull().references(() => sources.slug),
  market: text("market").notNull(),
  sourceSku: text("source_sku"),
  title: text("title").notNull(),
  productUrl: text("product_url").notNull(),
  imageUrl: text("image_url"),
  priceMinor: integer("price_minor").notNull(),
  currency: text("currency").notNull(),
  availability: text("availability").notNull(),
  observedAt: text("observed_at").notNull(),
  health: text("health").notNull().default("healthy"),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  index("offers_product_idx").on(table.productIdentityKey),
  index("offers_source_idx").on(table.sourceSlug),
  marketCurrencyCheck("offers_market_currency_check"),
]);

export const priceObservations = sqliteTable("price_observations", {
  observationKey: text("observation_key").primaryKey(),
  offerKey: text("offer_key").notNull().references(() => offers.offerKey),
  runId: text("run_id").notNull(),
  market: text("market").notNull(),
  priceMinor: integer("price_minor").notNull(),
  currency: text("currency").notNull(),
  availability: text("availability").notNull(),
  observedAt: text("observed_at").notNull(),
  rowFingerprint: text("row_fingerprint").notNull(),
}, (table) => [
  index("observations_offer_idx").on(table.offerKey, table.observedAt),
  uniqueIndex("observations_run_fingerprint_idx").on(table.runId, table.rowFingerprint),
  marketCurrencyCheck("observations_market_currency_check"),
]);

export const collectorRuns = sqliteTable("collector_runs", {
  runId: text("run_id").primaryKey(),
  sourceSlug: text("source_slug").notNull().references(() => sources.slug),
  market: text("market").notNull(),
  currency: text("currency").notNull(),
  status: text("status").notNull(),
  acceptedCount: integer("accepted_count").notNull().default(0),
  rejectedCount: integer("rejected_count").notNull().default(0),
  startedAt: text("started_at").notNull(),
  finishedAt: text("finished_at"),
  validationSummary: text("validation_summary").notNull().default("{}"),
});

export const quarantinedRows = sqliteTable("quarantined_rows", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  runId: text("run_id").notNull(),
  sourceSlug: text("source_slug"),
  rowIndex: integer("row_index").notNull(),
  reasonCodes: text("reason_codes").notNull(),
  rowFingerprint: text("row_fingerprint").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("quarantine_run_idx").on(table.runId),
  uniqueIndex("quarantine_run_fingerprint_idx").on(table.runId, table.rowFingerprint),
]);

export type SourceRow = typeof sources.$inferSelect;
export type ProductRow = typeof products.$inferSelect;
export type OfferRow = typeof offers.$inferSelect;
