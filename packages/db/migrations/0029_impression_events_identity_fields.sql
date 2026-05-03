-- Migration 0029: enrich impression_events with delivery identity/context signals
--
-- S61 started capturing a minimal identity snapshot in impression_events.
-- This migration stores the richer signal set already parsed by the tracker so
-- reporting can surface device/app/exchange context without relying on blanks.

ALTER TABLE impression_events
  ADD COLUMN IF NOT EXISTS device_id TEXT,
  ADD COLUMN IF NOT EXISTS device_type TEXT,
  ADD COLUMN IF NOT EXISTS device_model TEXT,
  ADD COLUMN IF NOT EXISTS browser TEXT,
  ADD COLUMN IF NOT EXISTS os TEXT,
  ADD COLUMN IF NOT EXISTS network_id TEXT,
  ADD COLUMN IF NOT EXISTS source_publisher_id TEXT,
  ADD COLUMN IF NOT EXISTS app_id TEXT,
  ADD COLUMN IF NOT EXISTS site_id TEXT,
  ADD COLUMN IF NOT EXISTS exchange_id TEXT,
  ADD COLUMN IF NOT EXISTS exchange_publisher_id TEXT,
  ADD COLUMN IF NOT EXISTS exchange_site_id_or_domain TEXT,
  ADD COLUMN IF NOT EXISTS app_bundle TEXT,
  ADD COLUMN IF NOT EXISTS app_name TEXT,
  ADD COLUMN IF NOT EXISTS page_position TEXT,
  ADD COLUMN IF NOT EXISTS content_language TEXT,
  ADD COLUMN IF NOT EXISTS content_title TEXT,
  ADD COLUMN IF NOT EXISTS content_series TEXT,
  ADD COLUMN IF NOT EXISTS carrier TEXT,
  ADD COLUMN IF NOT EXISTS app_store_name TEXT,
  ADD COLUMN IF NOT EXISTS content_genre TEXT,
  ADD COLUMN IF NOT EXISTS contextual_ids TEXT;

CREATE INDEX IF NOT EXISTS impression_events_device_id_idx
  ON impression_events (device_id);

CREATE INDEX IF NOT EXISTS impression_events_device_type_idx
  ON impression_events (device_type);
