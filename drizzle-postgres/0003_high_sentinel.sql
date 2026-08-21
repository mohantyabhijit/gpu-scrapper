-- Legacy ready claims were never server-verifiable. Demote them before the
-- admission trigger is installed; authoritative evidence can promote again.
UPDATE "sources" AS s SET "onboarding_status" = 'pending', "enabled" = false, "updated_at" = CURRENT_TIMESTAMP
WHERE EXISTS (SELECT 1 FROM "market_packs" AS p WHERE p."source_slug" = s."slug" AND p."status" = 'ready');
UPDATE "market_packs" SET "status" = 'pending', "updated_at" = CURRENT_TIMESTAMP WHERE "status" = 'ready';
--> statement-breakpoint
CREATE TABLE "market_pack_evidence" (
	"id" serial PRIMARY KEY NOT NULL,
	"pack_slug" text NOT NULL,
	"source_slug" text NOT NULL,
	"collector_id" text NOT NULL,
	"evidence_type" text NOT NULL,
	"verified_at" text NOT NULL,
	"verification_method" text NOT NULL,
	"verification_status" text DEFAULT 'verified' NOT NULL,
	"artifact_ref" text NOT NULL,
	"artifact_sha256" text NOT NULL,
	"run_id" text,
	"provider_response_id" text,
	"created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "market_pack_evidence_type_check" CHECK (evidence_type IN ('eligibility', 'collector_creation', 'successful_run')),
	CONSTRAINT "market_pack_evidence_status_check" CHECK (verification_status = 'verified'),
	CONSTRAINT "market_pack_evidence_collector_check" CHECK (collector_id ~ '^c_[A-Za-z0-9_-]{2,127}$'),
	CONSTRAINT "market_pack_evidence_hash_check" CHECK (artifact_sha256 ~ '^[a-fA-F0-9]{64}$'),
	CONSTRAINT "market_pack_evidence_artifact_ref_check" CHECK (artifact_ref ~ '^evidence/[A-Za-z0-9][A-Za-z0-9._/-]{0,254}$' AND artifact_ref NOT LIKE '%..%' AND artifact_ref NOT LIKE '%//%'),
	CONSTRAINT "market_pack_evidence_run_identity_check" CHECK ((evidence_type = 'successful_run' AND run_id IS NOT NULL AND provider_response_id IS NOT NULL) OR (evidence_type <> 'successful_run' AND run_id IS NULL AND provider_response_id IS NULL))
);
--> statement-breakpoint
CREATE INDEX "market_pack_evidence_boundary_idx" ON "market_pack_evidence" USING btree ("pack_slug","source_slug","collector_id","evidence_type");--> statement-breakpoint
CREATE UNIQUE INDEX "market_pack_evidence_type_boundary_idx" ON "market_pack_evidence" USING btree ("pack_slug","source_slug","collector_id","evidence_type");--> statement-breakpoint
CREATE UNIQUE INDEX "market_packs_slug_source_unique" ON "market_packs" USING btree ("slug","source_slug");
--> statement-breakpoint
ALTER TABLE "market_pack_evidence" ADD CONSTRAINT "market_pack_evidence_pack_source_fk" FOREIGN KEY ("pack_slug","source_slug") REFERENCES "market_packs"("slug","source_slug") ON DELETE NO ACTION ON UPDATE NO ACTION;
--> statement-breakpoint
ALTER TABLE "market_pack_evidence" ADD CONSTRAINT "market_pack_evidence_source_fk" FOREIGN KEY ("source_slug") REFERENCES "sources"("slug") ON DELETE NO ACTION ON UPDATE NO ACTION;
--> statement-breakpoint
ALTER TABLE "market_pack_evidence" ADD CONSTRAINT "market_pack_evidence_run_fk" FOREIGN KEY ("run_id") REFERENCES "collector_runs"("run_id") ON DELETE NO ACTION ON UPDATE NO ACTION;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION raster_country_pack_ready(p_pack_slug text)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  pack_row record;
  eligibility_row record;
  creation_row record;
  run_proof record;
BEGIN
  SELECT p.* INTO pack_row FROM market_packs p WHERE p.slug = p_pack_slug;
  IF NOT FOUND THEN RETURN false; END IF;
  SELECT e.* INTO eligibility_row FROM market_pack_evidence e WHERE e.pack_slug = pack_row.slug AND e.source_slug = pack_row.source_slug AND e.collector_id = pack_row.collector_id AND e.evidence_type = 'eligibility' AND e.verification_status = 'verified';
  SELECT e.* INTO creation_row FROM market_pack_evidence e WHERE e.pack_slug = pack_row.slug AND e.source_slug = pack_row.source_slug AND e.collector_id = pack_row.collector_id AND e.evidence_type = 'collector_creation' AND e.verification_status = 'verified';
  SELECT e.* INTO run_proof FROM market_pack_evidence e WHERE e.pack_slug = pack_row.slug AND e.source_slug = pack_row.source_slug AND e.collector_id = pack_row.collector_id AND e.evidence_type = 'successful_run' AND e.verification_status = 'verified';
  IF NOT FOUND OR eligibility_row IS NULL OR creation_row IS NULL THEN RETURN false; END IF;
  IF eligibility_row.verified_at > creation_row.verified_at OR creation_row.verified_at > run_proof.verified_at THEN RETURN false; END IF;
  RETURN EXISTS (
    SELECT 1 FROM collector_runs r
    WHERE r.run_id = run_proof.run_id
      AND r.source_slug = pack_row.source_slug
      AND r.collector_id = pack_row.collector_id
      AND r.response_id = run_proof.provider_response_id
      AND r.status = 'healthy'
      AND r.accepted_count > 0
      AND r.response_id IS NOT NULL
  );
END;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION raster_guard_country_pack_ready()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'ready' AND NOT raster_country_pack_ready(NEW.slug) THEN
    RAISE EXCEPTION 'country pack ready transition requires ordered verified evidence and successful non-empty run';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'ready' AND (
    NEW.source_slug IS DISTINCT FROM OLD.source_slug OR NEW.country_code IS DISTINCT FROM OLD.country_code OR NEW.currency IS DISTINCT FROM OLD.currency OR
    NEW.source_display_name IS DISTINCT FROM OLD.source_display_name OR NEW.base_url IS DISTINCT FROM OLD.base_url OR NEW.catalog_url IS DISTINCT FROM OLD.catalog_url OR
    NEW.allowed_hosts IS DISTINCT FROM OLD.allowed_hosts OR NEW.collector_id IS DISTINCT FROM OLD.collector_id
  ) THEN
    RAISE EXCEPTION 'ready market pack collector boundary is immutable';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER market_packs_country_pack_ready_guard
BEFORE INSERT OR UPDATE ON market_packs
FOR EACH ROW EXECUTE FUNCTION raster_guard_country_pack_ready();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION raster_guard_country_source_ready()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM market_packs p WHERE p.source_slug = NEW.slug)
     AND TG_OP = 'UPDATE' AND OLD.onboarding_status = 'ready' AND NEW.onboarding_status = 'ready' AND (
    NEW.display_name IS DISTINCT FROM OLD.display_name OR NEW.market IS DISTINCT FROM OLD.market OR NEW.region IS DISTINCT FROM OLD.region OR
    NEW.currency IS DISTINCT FROM OLD.currency OR NEW.base_url IS DISTINCT FROM OLD.base_url OR NEW.allowed_hosts IS DISTINCT FROM OLD.allowed_hosts OR
    NEW.catalog_url IS DISTINCT FROM OLD.catalog_url OR NEW.collector_ids IS DISTINCT FROM OLD.collector_ids
  ) THEN
    RAISE EXCEPTION 'ready country pack source boundary is immutable';
  END IF;
  IF EXISTS (SELECT 1 FROM market_packs p WHERE p.source_slug = NEW.slug)
     AND (NEW.onboarding_status = 'ready' OR NEW.enabled)
     AND NOT EXISTS (SELECT 1 FROM market_packs p WHERE p.source_slug = NEW.slug AND p.status = 'ready' AND raster_country_pack_ready(p.slug)) THEN
    RAISE EXCEPTION 'country pack source ready transition requires promoted pack evidence';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER sources_country_pack_ready_guard
BEFORE INSERT OR UPDATE ON sources
FOR EACH ROW EXECUTE FUNCTION raster_guard_country_source_ready();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION raster_reject_market_pack_evidence_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'market pack evidence is append-only';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER market_pack_evidence_append_only_update
BEFORE UPDATE ON market_pack_evidence
FOR EACH ROW EXECUTE FUNCTION raster_reject_market_pack_evidence_mutation();
--> statement-breakpoint
CREATE TRIGGER market_pack_evidence_append_only_delete
BEFORE DELETE ON market_pack_evidence
FOR EACH ROW EXECUTE FUNCTION raster_reject_market_pack_evidence_mutation();
