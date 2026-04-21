-- 0013_click_tracking.sql
CREATE TABLE IF NOT EXISTS click_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tag_id        UUID NOT NULL REFERENCES ad_tags(id) ON DELETE CASCADE,
  workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  creative_id   UUID REFERENCES creatives(id) ON DELETE SET NULL,
  impression_id UUID REFERENCES impression_events(id) ON DELETE SET NULL,
  ip            INET,
  user_agent    TEXT,
  country       CHAR(2),
  region        TEXT,
  referer       TEXT,
  redirect_url  TEXT,
  timestamp     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS click_events_tag_idx ON click_events(tag_id);
CREATE INDEX IF NOT EXISTS click_events_workspace_idx ON click_events(workspace_id);
CREATE INDEX IF NOT EXISTS click_events_timestamp_idx ON click_events(timestamp DESC);
CREATE INDEX IF NOT EXISTS click_events_tag_ts_idx ON click_events(tag_id, timestamp DESC);
