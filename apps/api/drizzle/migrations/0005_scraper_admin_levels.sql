-- Scraper DB: Admin level support
-- Run against the SCRAPER database (eulesia_scraper), not the main DB
--
-- Adds multi-level governance support to scraper_configs and discovery_runs.
-- All changes are backward-compatible — existing rows default to 'municipality'.

-- scraper_configs: new columns for multi-level governance
ALTER TABLE scraper_configs
  ADD COLUMN IF NOT EXISTS entity_name VARCHAR(200),
  ADD COLUMN IF NOT EXISTS admin_level VARCHAR(20) NOT NULL DEFAULT 'municipality',
  ADD COLUMN IF NOT EXISTS parent_entity VARCHAR(200);

-- discovery_runs: generic entity counters + admin level tracking
ALTER TABLE discovery_runs
  ADD COLUMN IF NOT EXISTS entities_probed INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS entities_found INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS admin_level VARCHAR(20) NOT NULL DEFAULT 'municipality';

-- Index for filtering by admin level
CREATE INDEX IF NOT EXISTS sc_admin_level_idx ON scraper_configs (admin_level);
