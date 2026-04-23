ALTER TABLE impression_events
  ADD COLUMN IF NOT EXISTS site_domain TEXT,
  ADD COLUMN IF NOT EXISTS page_url TEXT,
  ADD COLUMN IF NOT EXISTS device_type TEXT,
  ADD COLUMN IF NOT EXISTS browser TEXT,
  ADD COLUMN IF NOT EXISTS os TEXT;

ALTER TABLE click_events
  ADD COLUMN IF NOT EXISTS site_domain TEXT,
  ADD COLUMN IF NOT EXISTS page_url TEXT,
  ADD COLUMN IF NOT EXISTS device_type TEXT,
  ADD COLUMN IF NOT EXISTS browser TEXT,
  ADD COLUMN IF NOT EXISTS os TEXT;

CREATE INDEX IF NOT EXISTS impression_events_site_domain_idx ON impression_events(site_domain);
CREATE INDEX IF NOT EXISTS click_events_site_domain_idx ON click_events(site_domain);
CREATE INDEX IF NOT EXISTS impression_events_country_idx ON impression_events(country);
CREATE INDEX IF NOT EXISTS click_events_country_idx ON click_events(country);

CREATE TABLE IF NOT EXISTS tag_site_daily_stats (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tag_id        UUID NOT NULL REFERENCES ad_tags(id) ON DELETE CASCADE,
  date          DATE NOT NULL,
  site_domain   TEXT NOT NULL,
  impressions   BIGINT NOT NULL DEFAULT 0,
  clicks        BIGINT NOT NULL DEFAULT 0,
  viewable_imps BIGINT NOT NULL DEFAULT 0,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tag_id, date, site_domain)
);

CREATE INDEX IF NOT EXISTS tag_site_daily_stats_tag_idx ON tag_site_daily_stats(tag_id);
CREATE INDEX IF NOT EXISTS tag_site_daily_stats_date_idx ON tag_site_daily_stats(date DESC);
CREATE INDEX IF NOT EXISTS tag_site_daily_stats_site_idx ON tag_site_daily_stats(site_domain);

CREATE TABLE IF NOT EXISTS tag_country_daily_stats (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tag_id        UUID NOT NULL REFERENCES ad_tags(id) ON DELETE CASCADE,
  date          DATE NOT NULL,
  country       CHAR(2) NOT NULL,
  impressions   BIGINT NOT NULL DEFAULT 0,
  clicks        BIGINT NOT NULL DEFAULT 0,
  viewable_imps BIGINT NOT NULL DEFAULT 0,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tag_id, date, country)
);

CREATE INDEX IF NOT EXISTS tag_country_daily_stats_tag_idx ON tag_country_daily_stats(tag_id);
CREATE INDEX IF NOT EXISTS tag_country_daily_stats_date_idx ON tag_country_daily_stats(date DESC);
CREATE INDEX IF NOT EXISTS tag_country_daily_stats_country_idx ON tag_country_daily_stats(country);
