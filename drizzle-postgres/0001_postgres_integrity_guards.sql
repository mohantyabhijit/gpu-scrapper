CREATE OR REPLACE FUNCTION raster_guard_market_pack_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.source_slug IS DISTINCT FROM OLD.source_slug THEN
    RAISE EXCEPTION 'market pack source_slug is immutable';
  END IF;
  IF NEW.country_code IS DISTINCT FROM OLD.country_code
     OR NEW.currency IS DISTINCT FROM OLD.currency THEN
    RAISE EXCEPTION 'market pack country and currency are immutable';
  END IF;
  IF OLD.status = 'ready' AND (
    NEW.source_display_name IS DISTINCT FROM OLD.source_display_name
    OR NEW.base_url IS DISTINCT FROM OLD.base_url
    OR NEW.catalog_url IS DISTINCT FROM OLD.catalog_url
    OR NEW.allowed_hosts IS DISTINCT FROM OLD.allowed_hosts
    OR NEW.collector_id IS DISTINCT FROM OLD.collector_id
  ) THEN
    RAISE EXCEPTION 'ready market pack collector boundary is immutable';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER market_packs_integrity_guard
BEFORE UPDATE ON market_packs
FOR EACH ROW EXECUTE FUNCTION raster_guard_market_pack_update();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION raster_reject_healing_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'healing evidence is append-only';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER healing_events_append_only_update
BEFORE UPDATE ON healing_events
FOR EACH ROW EXECUTE FUNCTION raster_reject_healing_mutation();
--> statement-breakpoint
CREATE TRIGGER healing_events_append_only_delete
BEFORE DELETE ON healing_events
FOR EACH ROW EXECUTE FUNCTION raster_reject_healing_mutation();
