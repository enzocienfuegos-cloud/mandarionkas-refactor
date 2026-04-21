-- 0023_embed_keys.sql
CREATE TABLE IF NOT EXISTS embed_keys (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  tag_id        UUID REFERENCES ad_tags(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  key           TEXT NOT NULL UNIQUE,
  allowed_origins TEXT[] NOT NULL DEFAULT '{}',
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  expires_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS embed_keys_workspace_idx ON embed_keys(workspace_id);
CREATE INDEX IF NOT EXISTS embed_keys_tag_idx ON embed_keys(tag_id);
CREATE INDEX IF NOT EXISTS embed_keys_key_idx ON embed_keys(key);
