CREATE TABLE IF NOT EXISTS creative_tag_bindings (
  id                      TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  workspace_id            TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  tag_id                  TEXT NOT NULL REFERENCES ad_tags(id) ON DELETE CASCADE,
  creative_version_id     TEXT NOT NULL REFERENCES creative_versions(id) ON DELETE CASCADE,
  creative_size_variant_id TEXT,
  status                  TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'paused', 'archived')),
  weight                  INTEGER NOT NULL DEFAULT 1 CHECK (weight > 0),
  start_at                TIMESTAMPTZ,
  end_at                  TIMESTAMPTZ,
  created_by              TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS creative_tag_bindings_workspace_idx
  ON creative_tag_bindings(workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS creative_tag_bindings_tag_idx
  ON creative_tag_bindings(tag_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS creative_tag_bindings_version_idx
  ON creative_tag_bindings(creative_version_id, status, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS creative_tag_bindings_unique_assignment_idx
  ON creative_tag_bindings(tag_id, creative_version_id, COALESCE(creative_size_variant_id, ''));
