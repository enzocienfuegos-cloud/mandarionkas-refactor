-- 0029_api_keys.sql
CREATE TABLE IF NOT EXISTS api_keys (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  hashed_key    TEXT NOT NULL,
  prefix        TEXT NOT NULL,
  scopes        TEXT[] NOT NULL DEFAULT '{}',
  created_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  expires_at    TIMESTAMPTZ,
  revoked_at    TIMESTAMPTZ,
  last_used_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Partial unique index: only one active (non-revoked) key per hashed value
CREATE UNIQUE INDEX IF NOT EXISTS api_keys_hashed_key_active_idx
  ON api_keys(hashed_key)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS api_keys_workspace_idx ON api_keys(workspace_id);
CREATE INDEX IF NOT EXISTS api_keys_prefix_idx ON api_keys(prefix);
CREATE INDEX IF NOT EXISTS api_keys_created_by_idx ON api_keys(created_by);
