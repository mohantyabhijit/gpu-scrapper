CREATE TABLE `market_packs` (
	`slug` text PRIMARY KEY NOT NULL,
	`country_code` text NOT NULL,
	`label` text NOT NULL,
	`currency` text NOT NULL,
	`locale` text NOT NULL,
	`symbol` text NOT NULL,
	`source_slug` text NOT NULL,
	`source_display_name` text NOT NULL,
	`base_url` text NOT NULL,
	`catalog_url` text NOT NULL,
	`allowed_hosts` text NOT NULL,
	`collector_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`eligibility_evidence_ref` text,
	`eligibility_verified_at` text,
	`collector_created_evidence_ref` text,
	`collector_created_at` text,
	`collector_run_evidence_ref` text,
	`collector_run_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "market_packs_status_check" CHECK(status IN ('pending', 'ready')),
	CONSTRAINT "market_packs_code_currency_check" CHECK(length(country_code) = 2 AND country_code = upper(country_code)
    AND length(currency) = 3 AND currency = upper(currency))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `market_packs_country_code_unique` ON `market_packs` (`country_code`);--> statement-breakpoint
CREATE UNIQUE INDEX `market_packs_source_slug_unique` ON `market_packs` (`source_slug`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_offers` (
	`offer_key` text PRIMARY KEY NOT NULL,
	`product_identity_key` text NOT NULL,
	`source_slug` text NOT NULL,
	`market` text NOT NULL,
	`source_sku` text,
	`title` text NOT NULL,
	`product_url` text NOT NULL,
	`image_url` text,
	`price_minor` integer NOT NULL,
	`currency` text NOT NULL,
	`availability` text NOT NULL,
	`observed_at` text NOT NULL,
	`health` text DEFAULT 'healthy' NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`product_identity_key`) REFERENCES `products`(`identity_key`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`source_slug`) REFERENCES `sources`(`slug`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "offers_market_currency_check" CHECK(length(market) = 2 AND market = upper(market)
    AND length(currency) = 3 AND currency = upper(currency))
);
--> statement-breakpoint
INSERT INTO `__new_offers`("offer_key", "product_identity_key", "source_slug", "market", "source_sku", "title", "product_url", "image_url", "price_minor", "currency", "availability", "observed_at", "health", "updated_at") SELECT "offer_key", "product_identity_key", "source_slug", "market", "source_sku", "title", "product_url", "image_url", "price_minor", "currency", "availability", "observed_at", "health", "updated_at" FROM `offers`;--> statement-breakpoint
DROP TABLE `offers`;--> statement-breakpoint
ALTER TABLE `__new_offers` RENAME TO `offers`;--> statement-breakpoint
CREATE INDEX `offers_product_idx` ON `offers` (`product_identity_key`);--> statement-breakpoint
CREATE INDEX `offers_source_idx` ON `offers` (`source_slug`);--> statement-breakpoint
CREATE TABLE `__new_price_observations` (
	`observation_key` text PRIMARY KEY NOT NULL,
	`offer_key` text NOT NULL,
	`run_id` text NOT NULL,
	`market` text NOT NULL,
	`price_minor` integer NOT NULL,
	`currency` text NOT NULL,
	`availability` text NOT NULL,
	`observed_at` text NOT NULL,
	`row_fingerprint` text NOT NULL,
	FOREIGN KEY (`offer_key`) REFERENCES `offers`(`offer_key`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "observations_market_currency_check" CHECK(length(market) = 2 AND market = upper(market)
    AND length(currency) = 3 AND currency = upper(currency))
);
--> statement-breakpoint
INSERT INTO `__new_price_observations`("observation_key", "offer_key", "run_id", "market", "price_minor", "currency", "availability", "observed_at", "row_fingerprint") SELECT "observation_key", "offer_key", "run_id", "market", "price_minor", "currency", "availability", "observed_at", "row_fingerprint" FROM `price_observations`;--> statement-breakpoint
DROP TABLE `price_observations`;--> statement-breakpoint
ALTER TABLE `__new_price_observations` RENAME TO `price_observations`;--> statement-breakpoint
CREATE INDEX `observations_offer_idx` ON `price_observations` (`offer_key`,`observed_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `observations_run_fingerprint_idx` ON `price_observations` (`run_id`,`row_fingerprint`);--> statement-breakpoint
CREATE TABLE `__new_sources` (
	`slug` text PRIMARY KEY NOT NULL,
	`display_name` text NOT NULL,
	`market` text NOT NULL,
	`region` text NOT NULL,
	`currency` text NOT NULL,
	`base_url` text NOT NULL,
	`role` text DEFAULT 'secondary' NOT NULL,
	`allowed_hosts` text DEFAULT '[]' NOT NULL,
	`catalog_url` text DEFAULT '' NOT NULL,
	`collector_ids` text DEFAULT '{}' NOT NULL,
	`onboarding_status` text DEFAULT 'pending' NOT NULL,
	`enabled` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "sources_market_currency_check" CHECK(length(market) = 2 AND market = upper(market)
    AND length(currency) = 3 AND currency = upper(currency)),
	CONSTRAINT "sources_role_check" CHECK(role IN ('primary', 'secondary', 'backup')),
	CONSTRAINT "sources_onboarding_status_check" CHECK(onboarding_status IN ('pending', 'ready'))
);
--> statement-breakpoint
INSERT INTO `__new_sources`("slug", "display_name", "market", "region", "currency", "base_url", "enabled", "created_at") SELECT "slug", "display_name", "market", "region", "currency", "base_url", false, "created_at" FROM `sources`;--> statement-breakpoint
DROP TABLE `sources`;--> statement-breakpoint
ALTER TABLE `__new_sources` RENAME TO `sources`;--> statement-breakpoint
PRAGMA foreign_keys=ON;
