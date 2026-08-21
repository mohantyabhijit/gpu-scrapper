CREATE TABLE `request_receipts` (
	`key` text PRIMARY KEY NOT NULL,
	`route` text NOT NULL,
	`created_at` text NOT NULL,
	`expires_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `request_receipts_expiry_idx` ON `request_receipts` (`expires_at`);