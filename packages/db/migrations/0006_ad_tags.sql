-- 0006_ad_tags.sql
CREATE TABLE IF NOT EXISTS ad_tags (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  campaign_id     UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  name            TEXT NOT NULL,
  format          TEXT NOT NULL DEFAULT 'display' CHECK (format IN ('vast','display','native')),
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','archived')),
  click_url       TEXT,
  impression_url  TEXT,
  tag_code        TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ad_tags_workspace_idx ON ad_tags(workspace_id);
CREATE INDEX IF NOT EXISTS ad_tags_campaign_idx ON ad_tags(campaign_id);
CREATE INDEX IF NOT EXISTS ad_tags_status_idx ON ad_tags(workspace_id, status);
