CREATE TABLE IF NOT EXISTS engagement_events (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tag_id                 UUID NOT NULL REFERENCES ad_tags(id) ON DELETE CASCADE,
  workspace_id           UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  creative_id            UUID REFERENCES creatives(id) ON DELETE SET NULL,
  creative_size_variant_id UUID REFERENCES creative_size_variants(id) ON DELETE SET NULL,
  impression_id          UUID REFERENCES impression_events(id) ON DELETE SET NULL,
  event_type             TEXT NOT NULL,
  ip                     INET,
  user_agent             TEXT,
  country                CHAR(2),
  region                 TEXT,
  referer                TEXT,
  site_domain            TEXT,
  page_url               TEXT,
  device_type            TEXT,
  browser                TEXT,
  os                     TEXT,
  hover_duration_ms      INTEGER,
  metadata               JSONB NOT NULL DEFAULT '{}'::jsonb,
  timestamp              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS engagement_events_tag_idx ON engagement_events(tag_id);
CREATE INDEX IF NOT EXISTS engagement_events_workspace_idx ON engagement_events(workspace_id);
CREATE INDEX IF NOT EXISTS engagement_events_ts_idx ON engagement_events(timestamp DESC);
CREATE INDEX IF NOT EXISTS engagement_events_type_idx ON engagement_events(event_type);
CREATE INDEX IF NOT EXISTS engagement_events_variant_idx ON engagement_events(creative_size_variant_id);

CREATE TABLE IF NOT EXISTS tag_engagement_daily_stats (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tag_id             UUID NOT NULL REFERENCES ad_tags(id) ON DELETE CASCADE,
  date               DATE NOT NULL,
  event_type         TEXT NOT NULL,
  event_count        BIGINT NOT NULL DEFAULT 0,
  total_duration_ms  BIGINT NOT NULL DEFAULT 0,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tag_id, date, event_type)
);

CREATE INDEX IF NOT EXISTS tag_engagement_daily_stats_tag_idx ON tag_engagement_daily_stats(tag_id);
CREATE INDEX IF NOT EXISTS tag_engagement_daily_stats_date_idx ON tag_engagement_daily_stats(date DESC);
CREATE INDEX IF NOT EXISTS tag_engagement_daily_stats_type_idx ON tag_engagement_daily_stats(event_type);
