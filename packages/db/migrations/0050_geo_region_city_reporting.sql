ALTER TABLE impression_events
  ADD COLUMN IF NOT EXISTS city TEXT;

ALTER TABLE click_events
  ADD COLUMN IF NOT EXISTS city TEXT;

ALTER TABLE engagement_events
  ADD COLUMN IF NOT EXISTS city TEXT;

CREATE INDEX IF NOT EXISTS impression_events_city_idx ON impression_events(city);
CREATE INDEX IF NOT EXISTS click_events_city_idx ON click_events(city);
CREATE INDEX IF NOT EXISTS engagement_events_city_idx ON engagement_events(city);

CREATE TABLE IF NOT EXISTS tag_region_daily_stats (
  tag_id            UUID NOT NULL REFERENCES ad_tags(id) ON DELETE CASCADE,
  date              DATE NOT NULL,
  region            TEXT NOT NULL,
  impressions       BIGINT NOT NULL DEFAULT 0,
  clicks            BIGINT NOT NULL DEFAULT 0,
  measured_imps     BIGINT NOT NULL DEFAULT 0,
  viewable_imps     BIGINT NOT NULL DEFAULT 0,
  undetermined_imps BIGINT NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tag_id, date, region)
);

CREATE INDEX IF NOT EXISTS tag_region_daily_stats_tag_idx ON tag_region_daily_stats(tag_id);
CREATE INDEX IF NOT EXISTS tag_region_daily_stats_date_idx ON tag_region_daily_stats(date DESC);
CREATE INDEX IF NOT EXISTS tag_region_daily_stats_region_idx ON tag_region_daily_stats(region);

CREATE TABLE IF NOT EXISTS tag_city_daily_stats (
  tag_id            UUID NOT NULL REFERENCES ad_tags(id) ON DELETE CASCADE,
  date              DATE NOT NULL,
  city              TEXT NOT NULL,
  impressions       BIGINT NOT NULL DEFAULT 0,
  clicks            BIGINT NOT NULL DEFAULT 0,
  measured_imps     BIGINT NOT NULL DEFAULT 0,
  viewable_imps     BIGINT NOT NULL DEFAULT 0,
  undetermined_imps BIGINT NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tag_id, date, city)
);

CREATE INDEX IF NOT EXISTS tag_city_daily_stats_tag_idx ON tag_city_daily_stats(tag_id);
CREATE INDEX IF NOT EXISTS tag_city_daily_stats_date_idx ON tag_city_daily_stats(date DESC);
CREATE INDEX IF NOT EXISTS tag_city_daily_stats_city_idx ON tag_city_daily_stats(city);
