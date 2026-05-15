-- Migration 0046: capture Basis macro identifiers for tracker reconciliation
--
-- These nullable fields let Dusk compare and dedupe adserver events against DSP
-- auction-level reporting without changing behavior for non-Basis delivery.

ALTER TABLE click_events
  ADD COLUMN IF NOT EXISTS auction_id TEXT,
  ADD COLUMN IF NOT EXISTS basis_ts TEXT,
  ADD COLUMN IF NOT EXISTS click_invalid SMALLINT,
  ADD COLUMN IF NOT EXISTS traffic_type TEXT,
  ADD COLUMN IF NOT EXISTS creative_type TEXT,
  ADD COLUMN IF NOT EXISTS dimensions TEXT,
  ADD COLUMN IF NOT EXISTS ifa TEXT,
  ADD COLUMN IF NOT EXISTS basis_campaign_id TEXT,
  ADD COLUMN IF NOT EXISTS basis_ad_id TEXT,
  ADD COLUMN IF NOT EXISTS source_site_id TEXT,
  ADD COLUMN IF NOT EXISTS app_id TEXT,
  ADD COLUMN IF NOT EXISTS domain TEXT,
  ADD COLUMN IF NOT EXISTS request_method TEXT,
  ADD COLUMN IF NOT EXISTS raw_click_url TEXT,
  ADD COLUMN IF NOT EXISTS is_filtered BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS filter_reason TEXT;

CREATE INDEX IF NOT EXISTS click_events_auction_id_idx
  ON click_events (auction_id)
  WHERE auction_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS click_events_click_invalid_idx
  ON click_events (click_invalid)
  WHERE click_invalid IS NOT NULL;

CREATE INDEX IF NOT EXISTS click_events_request_method_ts_idx
  ON click_events (request_method, timestamp DESC)
  WHERE request_method IS NOT NULL;

ALTER TABLE impression_events
  ADD COLUMN IF NOT EXISTS auction_id TEXT,
  ADD COLUMN IF NOT EXISTS basis_ts TEXT,
  ADD COLUMN IF NOT EXISTS traffic_type TEXT,
  ADD COLUMN IF NOT EXISTS creative_type TEXT,
  ADD COLUMN IF NOT EXISTS dimensions TEXT,
  ADD COLUMN IF NOT EXISTS ifa TEXT,
  ADD COLUMN IF NOT EXISTS basis_campaign_id TEXT,
  ADD COLUMN IF NOT EXISTS basis_ad_id TEXT,
  ADD COLUMN IF NOT EXISTS source_site_id TEXT,
  ADD COLUMN IF NOT EXISTS app_id TEXT,
  ADD COLUMN IF NOT EXISTS domain TEXT;

CREATE INDEX IF NOT EXISTS impression_events_auction_id_idx
  ON impression_events (auction_id)
  WHERE auction_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS impression_events_basis_campaign_ts_idx
  ON impression_events (basis_campaign_id, timestamp DESC)
  WHERE basis_campaign_id IS NOT NULL;
