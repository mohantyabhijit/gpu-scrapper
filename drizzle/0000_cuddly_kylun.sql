CREATE TABLE `collector_runs` (
	`run_id` text PRIMARY KEY NOT NULL,
	`source_slug` text NOT NULL,
	`market` text NOT NULL,
	`currency` text NOT NULL,
	`status` text NOT NULL,
	`accepted_count` integer DEFAULT 0 NOT NULL,
	`rejected_count` integer DEFAULT 0 NOT NULL,
	`started_at` text NOT NULL,
	`finished_at` text,
	`validation_summary` text DEFAULT '{}' NOT NULL,
	FOREIGN KEY (`source_slug`) REFERENCES `sources`(`slug`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `offers` (
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
	CONSTRAINT "offers_market_currency_check" CHECK((market = 'US' AND currency = 'USD')
    OR (market = 'UK' AND currency = 'GBP')
    OR (market = 'IN' AND currency = 'INR')
    OR (market = 'SG' AND currency = 'SGD'))
);
--> statement-breakpoint
CREATE INDEX `offers_product_idx` ON `offers` (`product_identity_key`);--> statement-breakpoint
CREATE INDEX `offers_source_idx` ON `offers` (`source_slug`);--> statement-breakpoint
CREATE TABLE `price_observations` (
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
	CONSTRAINT "observations_market_currency_check" CHECK((market = 'US' AND currency = 'USD')
    OR (market = 'UK' AND currency = 'GBP')
    OR (market = 'IN' AND currency = 'INR')
    OR (market = 'SG' AND currency = 'SGD'))
);
--> statement-breakpoint
CREATE INDEX `observations_offer_idx` ON `price_observations` (`offer_key`,`observed_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `observations_run_fingerprint_idx` ON `price_observations` (`run_id`,`row_fingerprint`);--> statement-breakpoint
CREATE TABLE `products` (
	`identity_key` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`gpu_family` text NOT NULL,
	`model` text NOT NULL,
	`board_partner` text,
	`vram_gb` integer,
	`mpn` text,
	`search_text` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `products_slug_unique` ON `products` (`slug`);--> statement-breakpoint
CREATE INDEX `products_search_idx` ON `products` (`search_text`);--> statement-breakpoint
CREATE TABLE `quarantined_rows` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`run_id` text NOT NULL,
	`source_slug` text,
	`row_index` integer NOT NULL,
	`reason_codes` text NOT NULL,
	`row_fingerprint` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `quarantine_run_idx` ON `quarantined_rows` (`run_id`);--> statement-breakpoint
CREATE TABLE `sources` (
	`slug` text PRIMARY KEY NOT NULL,
	`display_name` text NOT NULL,
	`market` text NOT NULL,
	`region` text NOT NULL,
	`currency` text NOT NULL,
	`base_url` text NOT NULL,
	`enabled` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "sources_market_currency_check" CHECK((market = 'US' AND currency = 'USD')
    OR (market = 'UK' AND currency = 'GBP')
    OR (market = 'IN' AND currency = 'INR')
    OR (market = 'SG' AND currency = 'SGD'))
);
