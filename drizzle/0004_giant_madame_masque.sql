CREATE TABLE `healing_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_id` text NOT NULL,
	`source_slug` text NOT NULL,
	`collector_id` text NOT NULL,
	`stage` text NOT NULL,
	`occurred_at` text NOT NULL,
	`evidence_ref` text NOT NULL,
	`detail` text NOT NULL,
	`accepted_count` integer,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`source_slug`) REFERENCES `sources`(`slug`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "healing_events_stage_check" CHECK(stage IN ('healthy', 'broken', 'quarantined', 'previewed', 'approved', 'rerun', 'published')),
	CONSTRAINT "healing_events_accepted_count_check" CHECK(accepted_count IS NULL OR accepted_count >= 0)
);
--> statement-breakpoint
CREATE INDEX `healing_events_session_idx` ON `healing_events` (`session_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `healing_events_session_stage_idx` ON `healing_events` (`session_id`,`stage`);