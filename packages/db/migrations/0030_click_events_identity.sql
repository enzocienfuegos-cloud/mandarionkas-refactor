-- Migration 0030: persist click events with identity for reporting.
--
-- tag_daily_stats keeps aggregate click counts, but identity reporting needs a
-- per-click event tied to the same device_id used by impression_events.

CREATE TABLE IF NOT EXISTS click_events (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tag_id       TEXT NOT NULL REFERENCES ad_tags(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  device_id    TEXT,
  ip           INET,
  user_agent   TEXT,
  country      CHAR(2),
  region       TEXT,
  city         TEXT,
  site_domain  TEXT,
  referer      TEXT,
  timestamp    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS click_events_tag_idx
  ON click_events (tag_id);

CREATE INDEX IF NOT EXISTS click_events_workspace_idx
  ON click_events (workspace_id);

CREATE INDEX IF NOT EXISTS click_events_device_id_idx
  ON click_events (device_id);

CREATE INDEX IF NOT EXISTS click_events_timestamp_idx
  ON click_events (timestamp DESC);

CREATE INDEX IF NOT EXISTS click_events_tag_ts_idx
  ON click_events (tag_id, timestamp DESC);
