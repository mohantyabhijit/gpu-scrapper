import { sql } from "drizzle-orm";
import { boolean, check, index, integer, pgTable, serial, text, uniqueIndex } from "drizzle-orm/pg-core";

const marketCurrencyCheck = (name: string) =>
  check(name, sql`char_length(market) = 2 AND market = upper(market)
    AND char_length(currency) = 3 AND currency = upper(currency)`);

export const sources = pgTable("sources", {
  slug: text("slug").primaryKey(), displayName: text("display_name").notNull(), market: text("market").notNull(),
  region: text("region").notNull(), currency: text("currency").notNull(), baseUrl: text("base_url").notNull(),
  role: text("role").notNull().default("secondary"), allowedHosts: text("allowed_hosts").notNull().default("[]"),
  catalogUrl: text("catalog_url").notNull().default(""), collectorIds: text("collector_ids").notNull().default("{}"),
  onboardingStatus: text("onboarding_status").notNull().default("pending"), enabled: boolean("enabled").notNull().default(false),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`), updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, () => [marketCurrencyCheck("sources_market_currency_check"), check("sources_role_check", sql`role IN ('primary', 'secondary', 'backup')`), check("sources_onboarding_status_check", sql`onboarding_status IN ('pending', 'ready')`)]);

export const products = pgTable("products", {
  identityKey: text("identity_key").primaryKey(), slug: text("slug").notNull().unique(), gpuFamily: text("gpu_family").notNull(),
  model: text("model").notNull(), boardPartner: text("board_partner"), vramGb: integer("vram_gb"), mpn: text("mpn"),
  searchText: text("search_text").notNull(), updatedAt: text("updated_at").notNull(),
}, (table) => [index("products_search_idx").on(table.searchText)]);

export const offers = pgTable("offers", {
  offerKey: text("offer_key").primaryKey(), productIdentityKey: text("product_identity_key").notNull().references(() => products.identityKey),
  sourceSlug: text("source_slug").notNull().references(() => sources.slug), market: text("market").notNull(), sourceSku: text("source_sku"),
  title: text("title").notNull(), productUrl: text("product_url").notNull(), imageUrl: text("image_url"), priceMinor: integer("price_minor").notNull(),
  currency: text("currency").notNull(), availability: text("availability").notNull(), observedAt: text("observed_at").notNull(),
  health: text("health").notNull().default("healthy"), updatedAt: text("updated_at").notNull(),
}, (table) => [index("offers_product_idx").on(table.productIdentityKey), index("offers_source_idx").on(table.sourceSlug), marketCurrencyCheck("offers_market_currency_check")]);

export const priceObservations = pgTable("price_observations", {
  observationKey: text("observation_key").primaryKey(), offerKey: text("offer_key").notNull().references(() => offers.offerKey),
  runId: text("run_id").notNull(), market: text("market").notNull(), priceMinor: integer("price_minor").notNull(), currency: text("currency").notNull(),
  availability: text("availability").notNull(), observedAt: text("observed_at").notNull(), rowFingerprint: text("row_fingerprint").notNull(),
}, (table) => [index("observations_offer_idx").on(table.offerKey, table.observedAt), uniqueIndex("observations_run_fingerprint_idx").on(table.runId, table.rowFingerprint), marketCurrencyCheck("observations_market_currency_check")]);

export const collectorRuns = pgTable("collector_runs", {
  runId: text("run_id").primaryKey(), sourceSlug: text("source_slug").notNull().references(() => sources.slug),
  collectorId: text("collector_id"), responseId: text("response_id"), market: text("market").notNull(),
  currency: text("currency").notNull(), status: text("status").notNull(), acceptedCount: integer("accepted_count").notNull().default(0),
  rejectedCount: integer("rejected_count").notNull().default(0), startedAt: text("started_at").notNull(), finishedAt: text("finished_at"),
  validationSummary: text("validation_summary").notNull().default("{}"),
}, (table) => [
  index("collector_runs_source_response_idx").on(table.sourceSlug, table.responseId),
  index("collector_runs_collector_response_idx").on(table.collectorId, table.responseId),
  check("collector_runs_collector_id_check", sql`collector_id IS NULL OR collector_id ~ '^c_[A-Za-z0-9_-]{2,127}$'`),
  check("collector_runs_response_id_check", sql`response_id IS NULL OR char_length(response_id) BETWEEN 1 AND 256`),
]);

export const quarantinedRows = pgTable("quarantined_rows", {
  id: serial("id").primaryKey(), runId: text("run_id").notNull(), sourceSlug: text("source_slug"), rowIndex: integer("row_index").notNull(),
  reasonCodes: text("reason_codes").notNull(), rowFingerprint: text("row_fingerprint").notNull(), createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("quarantine_run_idx").on(table.runId), uniqueIndex("quarantine_run_fingerprint_idx").on(table.runId, table.rowFingerprint)]);

export const requestReceipts = pgTable("request_receipts", {
  key: text("key").primaryKey(), route: text("route").notNull(), createdAt: text("created_at").notNull(), expiresAt: text("expires_at").notNull(),
}, (table) => [index("request_receipts_expiry_idx").on(table.expiresAt)]);

export const healingEvents = pgTable("healing_events", {
  id: serial("id").primaryKey(), sessionId: text("session_id").notNull(), sourceSlug: text("source_slug").notNull().references(() => sources.slug),
  collectorId: text("collector_id").notNull(), stage: text("stage").notNull(), occurredAt: text("occurred_at").notNull(), evidenceRef: text("evidence_ref").notNull(),
  detail: text("detail").notNull(), acceptedCount: integer("accepted_count"), createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("healing_events_session_idx").on(table.sessionId, table.id), uniqueIndex("healing_events_session_stage_idx").on(table.sessionId, table.stage), check("healing_events_stage_check", sql`stage IN ('healthy', 'broken', 'quarantined', 'previewed', 'approved', 'rerun', 'published')`), check("healing_events_accepted_count_check", sql`accepted_count IS NULL OR accepted_count >= 0`)]);

export const marketPacks = pgTable("market_packs", {
  slug: text("slug").primaryKey(), countryCode: text("country_code").notNull().unique(), label: text("label").notNull(), currency: text("currency").notNull(),
  locale: text("locale").notNull(), symbol: text("symbol").notNull(), sourceSlug: text("source_slug").notNull().unique().references(() => sources.slug),
  sourceDisplayName: text("source_display_name").notNull(), baseUrl: text("base_url").notNull(), catalogUrl: text("catalog_url").notNull(),
  allowedHosts: text("allowed_hosts").notNull(), collectorId: text("collector_id").notNull(), status: text("status").notNull().default("pending"),
  eligibilityEvidenceRef: text("eligibility_evidence_ref"), eligibilityVerifiedAt: text("eligibility_verified_at"), collectorCreatedEvidenceRef: text("collector_created_evidence_ref"),
  collectorCreatedAt: text("collector_created_at"), collectorRunEvidenceRef: text("collector_run_evidence_ref"), collectorRunAt: text("collector_run_at"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`), updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("market_packs_slug_source_unique").on(table.slug, table.sourceSlug),
  check("market_packs_status_check", sql`status IN ('pending', 'ready')`),
  check("market_packs_code_currency_check", sql`char_length(country_code) = 2 AND country_code = upper(country_code) AND char_length(currency) = 3 AND currency = upper(currency)`),
]);

/** Server-owned, append-only proof for one exact Country Pack boundary. */
export const marketPackEvidence = pgTable("market_pack_evidence", {
  id: serial("id").primaryKey(),
  packSlug: text("pack_slug").notNull(),
  sourceSlug: text("source_slug").notNull(),
  collectorId: text("collector_id").notNull(),
  evidenceType: text("evidence_type").notNull(),
  verifiedAt: text("verified_at").notNull(),
  verificationMethod: text("verification_method").notNull(),
  verificationStatus: text("verification_status").notNull().default("verified"),
  artifactRef: text("artifact_ref").notNull(),
  artifactSha256: text("artifact_sha256").notNull(),
  runId: text("run_id"),
  providerResponseId: text("provider_response_id"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("market_pack_evidence_boundary_idx").on(table.packSlug, table.sourceSlug, table.collectorId, table.evidenceType),
  uniqueIndex("market_pack_evidence_type_boundary_idx").on(table.packSlug, table.sourceSlug, table.collectorId, table.evidenceType),
  check("market_pack_evidence_type_check", sql`evidence_type IN ('eligibility', 'collector_creation', 'successful_run')`),
  check("market_pack_evidence_status_check", sql`verification_status = 'verified'`),
  check("market_pack_evidence_collector_check", sql`collector_id ~ '^c_[A-Za-z0-9_-]{2,127}$'`),
  check("market_pack_evidence_hash_check", sql`artifact_sha256 ~ '^[a-fA-F0-9]{64}$'`),
  check("market_pack_evidence_artifact_ref_check", sql`artifact_ref ~ '^evidence/[A-Za-z0-9][A-Za-z0-9._/-]{0,254}$' AND artifact_ref NOT LIKE '%..%' AND artifact_ref NOT LIKE '%//%'`),
  check("market_pack_evidence_run_identity_check", sql`(evidence_type = 'successful_run' AND run_id IS NOT NULL AND provider_response_id IS NOT NULL) OR (evidence_type <> 'successful_run' AND run_id IS NULL AND provider_response_id IS NULL)`),
]);

export type SourceRow = typeof sources.$inferSelect;
export type ProductRow = typeof products.$inferSelect;
export type OfferRow = typeof offers.$inferSelect;
export type MarketPackRow = typeof marketPacks.$inferSelect;
export type MarketPackEvidenceRow = typeof marketPackEvidence.$inferSelect;
export type HealingEventRow = typeof healingEvents.$inferSelect;
