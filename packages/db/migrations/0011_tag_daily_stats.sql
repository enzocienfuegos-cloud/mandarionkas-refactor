-- 0011_tag_daily_stats.sql
CREATE TABLE IF NOT EXISTS tag_daily_stats (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tag_id        UUID NOT NULL REFERENCES ad_tags(id) ON DELETE CASCADE,
  date          DATE NOT NULL,
  impressions   BIGINT NOT NULL DEFAULT 0,
  clicks        BIGINT NOT NULL DEFAULT 0,
  viewable_imps BIGINT NOT NULL DEFAULT 0,
  spend         NUMERIC(12,4) NOT NULL DEFAULT 0,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tag_id, date)
);

CREATE INDEX IF NOT EXISTS tag_daily_stats_tag_idx ON tag_daily_stats(tag_id);
CREATE INDEX IF NOT EXISTS tag_daily_stats_date_idx ON tag_daily_stats(date DESC);
CREATE INDEX IF NOT EXISTS tag_daily_stats_tag_date_idx ON tag_daily_stats(tag_id, date DESC);
