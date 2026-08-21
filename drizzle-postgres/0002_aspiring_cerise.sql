ALTER TABLE "collector_runs" ADD COLUMN "collector_id" text;--> statement-breakpoint
ALTER TABLE "collector_runs" ADD COLUMN "response_id" text;--> statement-breakpoint
CREATE INDEX "collector_runs_source_response_idx" ON "collector_runs" USING btree ("source_slug","response_id");--> statement-breakpoint
CREATE INDEX "collector_runs_collector_response_idx" ON "collector_runs" USING btree ("collector_id","response_id");--> statement-breakpoint
ALTER TABLE "collector_runs" ADD CONSTRAINT "collector_runs_collector_id_check" CHECK (collector_id IS NULL OR collector_id ~ '^c_[A-Za-z0-9_-]{2,127}$');--> statement-breakpoint
ALTER TABLE "collector_runs" ADD CONSTRAINT "collector_runs_response_id_check" CHECK (response_id IS NULL OR char_length(response_id) BETWEEN 1 AND 256);