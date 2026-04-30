CREATE TABLE IF NOT EXISTS advertisers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  domain        TEXT,
  industry      TEXT,
  contact_email TEXT,
  notes         TEXT,
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS advertisers_workspace_idx ON advertisers(workspace_id);
CREATE INDEX IF NOT EXISTS advertisers_status_idx ON advertisers(workspace_id, status);

CREATE TABLE IF NOT EXISTS campaigns (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  advertiser_id   UUID REFERENCES advertisers(id) ON DELETE SET NULL,
  external_id     TEXT,
  name            TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'completed', 'archived')),
  start_date      DATE,
  end_date        DATE,
  budget          NUMERIC(12,2),
  impression_goal BIGINT,
  daily_budget    NUMERIC(12,2),
  flight_type     TEXT CHECK (flight_type IN ('standard', 'always_on', 'sponsorship')),
  kpi             TEXT,
  kpi_goal        NUMERIC(12,4),
  currency        CHAR(3) NOT NULL DEFAULT 'USD',
  timezone        TEXT NOT NULL DEFAULT 'UTC',
  notes           TEXT,
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS campaigns_workspace_idx ON campaigns(workspace_id);
CREATE INDEX IF NOT EXISTS campaigns_advertiser_idx ON campaigns(advertiser_id);
CREATE INDEX IF NOT EXISTS campaigns_status_idx ON campaigns(workspace_id, status);
CREATE INDEX IF NOT EXISTS campaigns_external_id_idx ON campaigns(workspace_id, external_id) WHERE external_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS ad_tags (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id           UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  campaign_id            UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  name                   TEXT NOT NULL,
  format                 TEXT NOT NULL DEFAULT 'display' CHECK (format IN ('vast', 'display', 'native', 'tracker')),
  status                 TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'paused', 'archived')),
  click_url              TEXT,
  impression_url         TEXT,
  tag_code               TEXT,
  description            TEXT,
  targeting              JSONB NOT NULL DEFAULT '{}'::jsonb,
  frequency_cap          INT,
  frequency_cap_window   TEXT CHECK (frequency_cap_window IN ('hour', 'day', 'week')),
  geo_targets            TEXT[] NOT NULL DEFAULT '{}'::text[],
  device_targets         TEXT[] NOT NULL DEFAULT '{}'::text[],
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ad_tags_workspace_idx ON ad_tags(workspace_id);
CREATE INDEX IF NOT EXISTS ad_tags_campaign_idx ON ad_tags(campaign_id);
CREATE INDEX IF NOT EXISTS ad_tags_status_idx ON ad_tags(workspace_id, status);

CREATE TABLE IF NOT EXISTS tag_format_configs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tag_id          UUID NOT NULL REFERENCES ad_tags(id) ON DELETE CASCADE UNIQUE,
  vast_version    TEXT CHECK (vast_version IN ('2.0', '3.0', '4.0', '4.1', '4.2')),
  vast_wrapper    BOOLEAN NOT NULL DEFAULT FALSE,
  vast_url        TEXT,
  display_width   INT,
  display_height  INT,
  native_layout   JSONB,
  html_template   TEXT,
  tracker_type    TEXT CHECK (tracker_type IN ('impression', 'click', 'engagement')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS tag_format_configs_tag_idx ON tag_format_configs(tag_id);

CREATE TABLE IF NOT EXISTS tag_pixels (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tag_id      UUID NOT NULL REFERENCES ad_tags(id) ON DELETE CASCADE,
  pixel_type  TEXT NOT NULL CHECK (pixel_type IN ('impression', 'click', 'viewability', 'custom')),
  url         TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS tag_pixels_tag_idx ON tag_pixels(tag_id);

CREATE TABLE IF NOT EXISTS tag_daily_stats (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tag_id            UUID NOT NULL REFERENCES ad_tags(id) ON DELETE CASCADE,
  date              DATE NOT NULL,
  impressions       BIGINT NOT NULL DEFAULT 0,
  clicks            BIGINT NOT NULL DEFAULT 0,
  viewable_imps     BIGINT NOT NULL DEFAULT 0,
  measured_imps     BIGINT NOT NULL DEFAULT 0,
  undetermined_imps BIGINT NOT NULL DEFAULT 0,
  spend             NUMERIC(12,4) NOT NULL DEFAULT 0,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tag_id, date)
);

CREATE INDEX IF NOT EXISTS tag_daily_stats_tag_idx ON tag_daily_stats(tag_id);
CREATE INDEX IF NOT EXISTS tag_daily_stats_date_idx ON tag_daily_stats(date DESC);
CREATE INDEX IF NOT EXISTS tag_daily_stats_tag_date_idx ON tag_daily_stats(tag_id, date DESC);

CREATE TABLE IF NOT EXISTS tag_engagement_daily_stats (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tag_id            UUID NOT NULL REFERENCES ad_tags(id) ON DELETE CASCADE,
  date              DATE NOT NULL,
  event_type        TEXT NOT NULL,
  event_count       BIGINT NOT NULL DEFAULT 0,
  total_duration_ms BIGINT NOT NULL DEFAULT 0,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tag_id, date, event_type)
);

CREATE INDEX IF NOT EXISTS tag_engagement_daily_stats_tag_idx ON tag_engagement_daily_stats(tag_id);
CREATE INDEX IF NOT EXISTS tag_engagement_daily_stats_date_idx ON tag_engagement_daily_stats(date DESC);
CREATE INDEX IF NOT EXISTS tag_engagement_daily_stats_tag_date_idx ON tag_engagement_daily_stats(tag_id, date DESC);

CREATE TABLE IF NOT EXISTS impression_events (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tag_id                   UUID NOT NULL REFERENCES ad_tags(id) ON DELETE CASCADE,
  workspace_id             UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  creative_id              UUID,
  ip                       INET,
  user_agent               TEXT,
  country                  CHAR(2),
  region                   TEXT,
  city                     TEXT,
  site_domain              TEXT,
  referer                  TEXT,
  viewable                 BOOLEAN,
  viewability_duration_ms  BIGINT NOT NULL DEFAULT 0,
  timestamp                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS impression_events_tag_idx ON impression_events(tag_id);
CREATE INDEX IF NOT EXISTS impression_events_workspace_idx ON impression_events(workspace_id);
CREATE INDEX IF NOT EXISTS impression_events_timestamp_idx ON impression_events(timestamp DESC);
CREATE INDEX IF NOT EXISTS impression_events_tag_ts_idx ON impression_events(tag_id, timestamp DESC);

CREATE TABLE IF NOT EXISTS tag_health_logs (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tag_id               UUID NOT NULL REFERENCES ad_tags(id) ON DELETE CASCADE,
  workspace_id         UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  status               TEXT NOT NULL CHECK (status IN ('healthy', 'warning', 'critical', 'unknown')),
  last_impression_at   TIMESTAMPTZ,
  impression_count_24h BIGINT NOT NULL DEFAULT 0,
  error_rate           NUMERIC(10,4) NOT NULL DEFAULT 0,
  details              JSONB NOT NULL DEFAULT '{}'::jsonb,
  checked_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS tag_health_logs_workspace_idx ON tag_health_logs(workspace_id, checked_at DESC);
CREATE INDEX IF NOT EXISTS tag_health_logs_tag_idx ON tag_health_logs(tag_id, checked_at DESC);
