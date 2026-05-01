-- Migration 0024: Frequency Cap — device identity tracking
--
-- S46 adds first-party cookie (smx_uid) support to the tracker layer.
-- To enforce frequency caps we need to record impressions per device per tag per window.
--
-- Design decisions:
--   - smx_uid is a first-party cookie set by the tracker (SameSite=None; Secure).
--     It is a random UUID generated server-side on first impression, then echoed
--     back on subsequent requests. The tracker reads it from the Cookie header.
--   - tag_daily_stats gains a device_id column for aggregated per-device counts
--     (informational, not used for cap enforcement directly).
--   - tag_frequency_cap_events is the enforcement table: one row per
--     (tag_id, device_id, window_date). The window_date resets daily (or weekly
--     per frequency_cap_window). A SELECT COUNT on this table is the cap check.
--   - The cap check runs inside getLiveVastXml before serving XML.
--     Capped requests get a VAST 3.0 <NoAd /> response, not a 403.
--
-- Indexes are designed for the two hot paths:
--   1. Cap check:  WHERE tag_id = $1 AND device_id = $2 AND window_date >= $3
--   2. Housekeeping: DELETE WHERE window_date < NOW() - 30 days

-- ── device_id on tag_daily_stats (informational) ────────────────────────────
ALTER TABLE tag_daily_stats
  ADD COLUMN IF NOT EXISTS device_id TEXT;

-- ── tag_frequency_cap_events ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tag_frequency_cap_events (
  id          TEXT        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tag_id      TEXT        NOT NULL,
  device_id   TEXT        NOT NULL,
  workspace_id TEXT       NOT NULL,

  -- Date of the event — used for daily/weekly window calculation.
  -- Stored as date (not timestamptz) for efficient GROUP BY / COUNT.
  event_date  DATE        NOT NULL DEFAULT CURRENT_DATE,

  -- Impression count for this (tag, device, date) combo.
  -- Incremented on each impression, not one row per impression.
  impressions INTEGER     NOT NULL DEFAULT 1,

  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (tag_id, device_id, event_date)
);

-- Cap check index: look up all dates in the window for a (tag, device) pair.
CREATE INDEX IF NOT EXISTS tag_frequency_cap_events_lookup_idx
  ON tag_frequency_cap_events (tag_id, device_id, event_date DESC);

-- Workspace index for housekeeping queries.
CREATE INDEX IF NOT EXISTS tag_frequency_cap_events_workspace_idx
  ON tag_frequency_cap_events (workspace_id, event_date DESC);

-- Housekeeping index: purge old events.
CREATE INDEX IF NOT EXISTS tag_frequency_cap_events_date_idx
  ON tag_frequency_cap_events (event_date ASC);
