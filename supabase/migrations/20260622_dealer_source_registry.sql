-- Source registry columns on dealers table
-- Migration: 20260622_dealer_source_registry

ALTER TABLE dealers
  ADD COLUMN IF NOT EXISTS adapter_key            TEXT,
  ADD COLUMN IF NOT EXISTS platform_type          TEXT,
  ADD COLUMN IF NOT EXISTS discovery_strategy     TEXT,
  ADD COLUMN IF NOT EXISTS inventory_source_url   TEXT,
  ADD COLUMN IF NOT EXISTS canonical_domain       TEXT,
  ADD COLUMN IF NOT EXISTS domain_aliases         TEXT[],
  ADD COLUMN IF NOT EXISTS browser_required       BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS sync_enabled           BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS last_discovery_status  TEXT,
  ADD COLUMN IF NOT EXISTS last_discovery_message TEXT,
  ADD COLUMN IF NOT EXISTS last_discovery_at      TIMESTAMPTZ;

COMMENT ON COLUMN dealers.adapter_key            IS 'Routes to the correct sync adapter. e.g. botero, jax, jenkins, discovery';
COMMENT ON COLUMN dealers.platform_type          IS 'gcr_wordpress | dealerspike | dx1 | shopify | wordpress | wix | custom | unknown';
COMMENT ON COLUMN dealers.discovery_strategy     IS 'gcr_sitemap | browser_inventory | api | manual | not_configured';
COMMENT ON COLUMN dealers.inventory_source_url   IS 'Direct URL to inventory page or sitemap';
COMMENT ON COLUMN dealers.canonical_domain       IS 'Primary domain for sitemap/inventory fetching';
COMMENT ON COLUMN dealers.browser_required       IS 'If true, Playwright required — cannot run serverless';
COMMENT ON COLUMN dealers.sync_enabled           IS 'If false, skip in all sync runs';
COMMENT ON COLUMN dealers.last_discovery_status  IS 'ok | no_new | error | not_configured | needs_browser';
COMMENT ON COLUMN dealers.last_discovery_message IS 'Human-readable result from last discovery run';

CREATE INDEX IF NOT EXISTS idx_dealers_adapter_key   ON dealers(adapter_key);
CREATE INDEX IF NOT EXISTS idx_dealers_platform_type ON dealers(platform_type);
