ALTER TABLE impression_events
  ADD COLUMN IF NOT EXISTS device_id TEXT,
  ADD COLUMN IF NOT EXISTS cookie_id TEXT;

ALTER TABLE click_events
  ADD COLUMN IF NOT EXISTS device_id TEXT,
  ADD COLUMN IF NOT EXISTS cookie_id TEXT;

ALTER TABLE engagement_events
  ADD COLUMN IF NOT EXISTS device_id TEXT,
  ADD COLUMN IF NOT EXISTS cookie_id TEXT;

CREATE INDEX IF NOT EXISTS impression_events_device_id_idx ON impression_events(device_id);
CREATE INDEX IF NOT EXISTS impression_events_cookie_id_idx ON impression_events(cookie_id);
CREATE INDEX IF NOT EXISTS click_events_device_id_idx ON click_events(device_id);
CREATE INDEX IF NOT EXISTS click_events_cookie_id_idx ON click_events(cookie_id);
CREATE INDEX IF NOT EXISTS engagement_events_device_id_idx ON engagement_events(device_id);
CREATE INDEX IF NOT EXISTS engagement_events_cookie_id_idx ON engagement_events(cookie_id);
