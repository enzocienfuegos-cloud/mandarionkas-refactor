-- 0004_advertisers.sql
CREATE TABLE IF NOT EXISTS advertisers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  domain        TEXT,
  industry      TEXT,
  contact_email TEXT,
  notes         TEXT,
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','archived')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS advertisers_workspace_idx ON advertisers(workspace_id);
CREATE INDEX IF NOT EXISTS advertisers_status_idx ON advertisers(workspace_id, status);
