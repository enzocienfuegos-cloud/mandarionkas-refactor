CREATE TABLE IF NOT EXISTS tracker_events_staging (
  id BIGSERIAL PRIMARY KEY,
  tag_id TEXT NOT NULL,
  event_date DATE NOT NULL DEFAULT CURRENT_DATE,
  impressions BIGINT NOT NULL DEFAULT 0,
  clicks BIGINT NOT NULL DEFAULT 0,
  flushed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS tracker_events_staging_unflushed_idx
  ON tracker_events_staging (tag_id, event_date)
  WHERE flushed = FALSE;

CREATE TABLE IF NOT EXISTS tracker_engagement_staging (
  id BIGSERIAL PRIMARY KEY,
  tag_id TEXT NOT NULL,
  event_date DATE NOT NULL DEFAULT CURRENT_DATE,
  event_type TEXT NOT NULL,
  event_count BIGINT NOT NULL DEFAULT 1,
  duration_ms BIGINT NOT NULL DEFAULT 0,
  flushed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS tracker_engagement_staging_unflushed_idx
  ON tracker_engagement_staging (tag_id, event_date, event_type)
  WHERE flushed = FALSE;
