ALTER TABLE impression_events
  ADD COLUMN IF NOT EXISTS device_model TEXT,
  ADD COLUMN IF NOT EXISTS contextual_ids TEXT,
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
  ADD COLUMN IF NOT EXISTS content_genre TEXT;

ALTER TABLE click_events
  ADD COLUMN IF NOT EXISTS device_model TEXT,
  ADD COLUMN IF NOT EXISTS contextual_ids TEXT,
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
  ADD COLUMN IF NOT EXISTS content_genre TEXT;

CREATE INDEX IF NOT EXISTS impression_events_device_model_idx ON impression_events(device_model);
CREATE INDEX IF NOT EXISTS click_events_device_model_idx ON click_events(device_model);
CREATE INDEX IF NOT EXISTS impression_events_network_id_idx ON impression_events(network_id);
CREATE INDEX IF NOT EXISTS click_events_network_id_idx ON click_events(network_id);
CREATE INDEX IF NOT EXISTS impression_events_source_publisher_id_idx ON impression_events(source_publisher_id);
CREATE INDEX IF NOT EXISTS click_events_source_publisher_id_idx ON click_events(source_publisher_id);
