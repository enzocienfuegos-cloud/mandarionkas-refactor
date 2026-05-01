CREATE TABLE IF NOT EXISTS api_keys (
  id                 TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  workspace_id       TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name               TEXT NOT NULL,
  key_prefix         TEXT NOT NULL,
  key_hash           TEXT NOT NULL,
  scopes             TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  status             TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  expires_at         TIMESTAMPTZ,
  last_used_at       TIMESTAMPTZ,
  revoked_at         TIMESTAMPTZ,
  created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS api_keys_workspace_idx
  ON api_keys(workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS api_keys_status_idx
  ON api_keys(workspace_id, status, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS api_keys_prefix_idx
  ON api_keys(key_prefix);
