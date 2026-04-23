CREATE TABLE IF NOT EXISTS saved_audiences (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id     UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  canonical_type   TEXT,
  country          TEXT,
  segment_preset   TEXT,
  min_impressions  INTEGER NOT NULL DEFAULT 0,
  min_clicks       INTEGER NOT NULL DEFAULT 0,
  status           TEXT NOT NULL DEFAULT 'active',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT saved_audiences_name_unique UNIQUE (workspace_id, name)
);

CREATE INDEX IF NOT EXISTS saved_audiences_workspace_idx
  ON saved_audiences(workspace_id, status, created_at DESC);
