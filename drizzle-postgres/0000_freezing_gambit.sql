CREATE TABLE "collector_runs" (
	"run_id" text PRIMARY KEY NOT NULL,
	"source_slug" text NOT NULL,
	"market" text NOT NULL,
	"currency" text NOT NULL,
	"status" text NOT NULL,
	"accepted_count" integer DEFAULT 0 NOT NULL,
	"rejected_count" integer DEFAULT 0 NOT NULL,
	"started_at" text NOT NULL,
	"finished_at" text,
	"validation_summary" text DEFAULT '{}' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "healing_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"source_slug" text NOT NULL,
	"collector_id" text NOT NULL,
	"stage" text NOT NULL,
	"occurred_at" text NOT NULL,
	"evidence_ref" text NOT NULL,
	"detail" text NOT NULL,
	"accepted_count" integer,
	"created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "healing_events_stage_check" CHECK (stage IN ('healthy', 'broken', 'quarantined', 'previewed', 'approved', 'rerun', 'published')),
	CONSTRAINT "healing_events_accepted_count_check" CHECK (accepted_count IS NULL OR accepted_count >= 0)
);
--> statement-breakpoint
CREATE TABLE "market_packs" (
	"slug" text PRIMARY KEY NOT NULL,
	"country_code" text NOT NULL,
	"label" text NOT NULL,
	"currency" text NOT NULL,
	"locale" text NOT NULL,
	"symbol" text NOT NULL,
	"source_slug" text NOT NULL,
	"source_display_name" text NOT NULL,
	"base_url" text NOT NULL,
	"catalog_url" text NOT NULL,
	"allowed_hosts" text NOT NULL,
	"collector_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"eligibility_evidence_ref" text,
	"eligibility_verified_at" text,
	"collector_created_evidence_ref" text,
	"collector_created_at" text,
	"collector_run_evidence_ref" text,
	"collector_run_at" text,
	"created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "market_packs_country_code_unique" UNIQUE("country_code"),
	CONSTRAINT "market_packs_source_slug_unique" UNIQUE("source_slug"),
	CONSTRAINT "market_packs_status_check" CHECK (status IN ('pending', 'ready')),
	CONSTRAINT "market_packs_code_currency_check" CHECK (char_length(country_code) = 2 AND country_code = upper(country_code) AND char_length(currency) = 3 AND currency = upper(currency))
);
--> statement-breakpoint
CREATE TABLE "offers" (
	"offer_key" text PRIMARY KEY NOT NULL,
	"product_identity_key" text NOT NULL,
	"source_slug" text NOT NULL,
	"market" text NOT NULL,
	"source_sku" text,
	"title" text NOT NULL,
	"product_url" text NOT NULL,
	"image_url" text,
	"price_minor" integer NOT NULL,
	"currency" text NOT NULL,
	"availability" text NOT NULL,
	"observed_at" text NOT NULL,
	"health" text DEFAULT 'healthy' NOT NULL,
	"updated_at" text NOT NULL,
	CONSTRAINT "offers_market_currency_check" CHECK (char_length(market) = 2 AND market = upper(market)
    AND char_length(currency) = 3 AND currency = upper(currency))
);
--> statement-breakpoint
CREATE TABLE "price_observations" (
	"observation_key" text PRIMARY KEY NOT NULL,
	"offer_key" text NOT NULL,
	"run_id" text NOT NULL,
	"market" text NOT NULL,
	"price_minor" integer NOT NULL,
	"currency" text NOT NULL,
	"availability" text NOT NULL,
	"observed_at" text NOT NULL,
	"row_fingerprint" text NOT NULL,
	CONSTRAINT "observations_market_currency_check" CHECK (char_length(market) = 2 AND market = upper(market)
    AND char_length(currency) = 3 AND currency = upper(currency))
);
--> statement-breakpoint
CREATE TABLE "products" (
	"identity_key" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"gpu_family" text NOT NULL,
	"model" text NOT NULL,
	"board_partner" text,
	"vram_gb" integer,
	"mpn" text,
	"search_text" text NOT NULL,
	"updated_at" text NOT NULL,
	CONSTRAINT "products_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "quarantined_rows" (
	"id" serial PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"source_slug" text,
	"row_index" integer NOT NULL,
	"reason_codes" text NOT NULL,
	"row_fingerprint" text NOT NULL,
	"created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "request_receipts" (
	"key" text PRIMARY KEY NOT NULL,
	"route" text NOT NULL,
	"created_at" text NOT NULL,
	"expires_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"slug" text PRIMARY KEY NOT NULL,
	"display_name" text NOT NULL,
	"market" text NOT NULL,
	"region" text NOT NULL,
	"currency" text NOT NULL,
	"base_url" text NOT NULL,
	"role" text DEFAULT 'secondary' NOT NULL,
	"allowed_hosts" text DEFAULT '[]' NOT NULL,
	"catalog_url" text DEFAULT '' NOT NULL,
	"collector_ids" text DEFAULT '{}' NOT NULL,
	"onboarding_status" text DEFAULT 'pending' NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "sources_market_currency_check" CHECK (char_length(market) = 2 AND market = upper(market)
    AND char_length(currency) = 3 AND currency = upper(currency)),
	CONSTRAINT "sources_role_check" CHECK (role IN ('primary', 'secondary', 'backup')),
	CONSTRAINT "sources_onboarding_status_check" CHECK (onboarding_status IN ('pending', 'ready'))
);
--> statement-breakpoint
ALTER TABLE "collector_runs" ADD CONSTRAINT "collector_runs_source_slug_sources_slug_fk" FOREIGN KEY ("source_slug") REFERENCES "public"."sources"("slug") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "healing_events" ADD CONSTRAINT "healing_events_source_slug_sources_slug_fk" FOREIGN KEY ("source_slug") REFERENCES "public"."sources"("slug") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market_packs" ADD CONSTRAINT "market_packs_source_slug_sources_slug_fk" FOREIGN KEY ("source_slug") REFERENCES "public"."sources"("slug") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offers" ADD CONSTRAINT "offers_product_identity_key_products_identity_key_fk" FOREIGN KEY ("product_identity_key") REFERENCES "public"."products"("identity_key") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offers" ADD CONSTRAINT "offers_source_slug_sources_slug_fk" FOREIGN KEY ("source_slug") REFERENCES "public"."sources"("slug") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_observations" ADD CONSTRAINT "price_observations_offer_key_offers_offer_key_fk" FOREIGN KEY ("offer_key") REFERENCES "public"."offers"("offer_key") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "healing_events_session_idx" ON "healing_events" USING btree ("session_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "healing_events_session_stage_idx" ON "healing_events" USING btree ("session_id","stage");--> statement-breakpoint
CREATE INDEX "offers_product_idx" ON "offers" USING btree ("product_identity_key");--> statement-breakpoint
CREATE INDEX "offers_source_idx" ON "offers" USING btree ("source_slug");--> statement-breakpoint
CREATE INDEX "observations_offer_idx" ON "price_observations" USING btree ("offer_key","observed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "observations_run_fingerprint_idx" ON "price_observations" USING btree ("run_id","row_fingerprint");--> statement-breakpoint
CREATE INDEX "products_search_idx" ON "products" USING btree ("search_text");--> statement-breakpoint
CREATE INDEX "quarantine_run_idx" ON "quarantined_rows" USING btree ("run_id");--> statement-breakpoint
CREATE UNIQUE INDEX "quarantine_run_fingerprint_idx" ON "quarantined_rows" USING btree ("run_id","row_fingerprint");--> statement-breakpoint
CREATE INDEX "request_receipts_expiry_idx" ON "request_receipts" USING btree ("expires_at");