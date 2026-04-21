-- 0005_campaigns.sql
CREATE TABLE IF NOT EXISTS campaigns (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  advertiser_id   UUID REFERENCES advertisers(id) ON DELETE SET NULL,
  name            TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','paused','completed','archived')),
  start_date      DATE,
  end_date        DATE,
  budget          NUMERIC(12,2),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS campaigns_workspace_idx ON campaigns(workspace_id);
CREATE INDEX IF NOT EXISTS campaigns_advertiser_idx ON campaigns(advertiser_id);
CREATE INDEX IF NOT EXISTS campaigns_status_idx ON campaigns(workspace_id, status);
