-- Migration 0022: Tracker write support
-- Adds the columns and indexes required for public tracker endpoints to write
-- aggregated delivery metrics without relying on synchronous per-request work.

CREATE TABLE IF NOT EXISTS tag_daily_stats (
  tag_id TEXT NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  impressions BIGINT NOT NULL DEFAULT 0,
  clicks BIGINT NOT NULL DEFAULT 0,
  viewable_imps BIGINT NOT NULL DEFAULT 0,
  measured_imps BIGINT NOT NULL DEFAULT 0,
  undetermined_imps BIGINT NOT NULL DEFAULT 0,
  spend NUMERIC(12,4) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tag_id, date)
);

ALTER TABLE tag_daily_stats
  ADD COLUMN IF NOT EXISTS viewable_imps BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS measured_imps BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS undetermined_imps BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS spend NUMERIC(12,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS tag_daily_stats_date_idx
  ON tag_daily_stats (date DESC);

CREATE INDEX IF NOT EXISTS tag_daily_stats_tag_date_idx
  ON tag_daily_stats (tag_id, date DESC);

CREATE TABLE IF NOT EXISTS tag_engagement_daily_stats (
  tag_id TEXT NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  event_type TEXT NOT NULL,
  event_count BIGINT NOT NULL DEFAULT 0,
  total_duration_ms BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tag_id, date, event_type)
);

ALTER TABLE tag_engagement_daily_stats
  ADD COLUMN IF NOT EXISTS total_duration_ms BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS tag_eng_daily_tag_date_idx
  ON tag_engagement_daily_stats (tag_id, date DESC);

CREATE INDEX IF NOT EXISTS tag_eng_daily_event_idx
  ON tag_engagement_daily_stats (tag_id, event_type, date DESC);
