CREATE TRIGGER `market_packs_country_currency_immutable`
BEFORE UPDATE OF `country_code`, `currency` ON `market_packs`
WHEN OLD.`country_code` <> NEW.`country_code`
  OR OLD.`currency` <> NEW.`currency`
BEGIN
  SELECT RAISE(ABORT, 'market pack country and currency are immutable');
END;--> statement-breakpoint
CREATE TRIGGER `market_packs_ready_boundary_immutable`
BEFORE UPDATE OF `source_display_name`, `base_url`, `catalog_url`, `allowed_hosts`, `collector_id` ON `market_packs`
WHEN OLD.`status` = 'ready' AND (
  OLD.`source_display_name` <> NEW.`source_display_name`
  OR OLD.`base_url` <> NEW.`base_url`
  OR OLD.`catalog_url` <> NEW.`catalog_url`
  OR OLD.`allowed_hosts` <> NEW.`allowed_hosts`
  OR OLD.`collector_id` <> NEW.`collector_id`
)
BEGIN
  SELECT RAISE(ABORT, 'ready market pack collector boundary is immutable');
END;
