import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const marketCurrencyCheck = (name: string) =>
  check(name, sql`length(market) = 2 AND market = upper(market)
    AND length(currency) = 3 AND currency = upper(currency)`);

export const sources = sqliteTable("sources", {
  slug: text("slug").primaryKey(),
  displayName: text("display_name").notNull(),
  market: text("market").notNull(),
  region: text("region").notNull(),
  currency: text("currency").notNull(),
  baseUrl: text("base_url").notNull(),
  role: text("role").notNull().default("secondary"),
  allowedHosts: text("allowed_hosts").notNull().default("[]"),
  catalogUrl: text("catalog_url").notNull().default(""),
  collectorIds: text("collector_ids").notNull().default("{}"),
  onboardingStatus: text("onboarding_status").notNull().default("pending"),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, () => [
  marketCurrencyCheck("sources_market_currency_check"),
  check("sources_role_check", sql`role IN ('primary', 'secondary', 'backup')`),
  check("sources_onboarding_status_check", sql`onboarding_status IN ('pending', 'ready')`),
]);

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

export const marketPacks = sqliteTable("market_packs", {
  slug: text("slug").primaryKey(),
  countryCode: text("country_code").notNull().unique(),
  label: text("label").notNull(),
  currency: text("currency").notNull(),
  locale: text("locale").notNull(),
  symbol: text("symbol").notNull(),
  sourceSlug: text("source_slug").notNull().unique(),
  sourceDisplayName: text("source_display_name").notNull(),
  baseUrl: text("base_url").notNull(),
  catalogUrl: text("catalog_url").notNull(),
  allowedHosts: text("allowed_hosts").notNull(),
  collectorId: text("collector_id").notNull(),
  status: text("status").notNull().default("pending"),
  eligibilityEvidenceRef: text("eligibility_evidence_ref"),
  eligibilityVerifiedAt: text("eligibility_verified_at"),
  collectorCreatedEvidenceRef: text("collector_created_evidence_ref"),
  collectorCreatedAt: text("collector_created_at"),
  collectorRunEvidenceRef: text("collector_run_evidence_ref"),
  collectorRunAt: text("collector_run_at"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, () => [
  check("market_packs_status_check", sql`status IN ('pending', 'ready')`),
  check("market_packs_code_currency_check", sql`length(country_code) = 2 AND country_code = upper(country_code)
    AND length(currency) = 3 AND currency = upper(currency)`),
]);

export type SourceRow = typeof sources.$inferSelect;
export type ProductRow = typeof products.$inferSelect;
export type OfferRow = typeof offers.$inferSelect;
export type MarketPackRow = typeof marketPacks.$inferSelect;
