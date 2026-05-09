CREATE TABLE IF NOT EXISTS creative_size_variants (
  id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  workspace_id        TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  creative_version_id TEXT NOT NULL REFERENCES creative_versions(id) ON DELETE CASCADE,
  label               TEXT NOT NULL,
  width               INTEGER NOT NULL CHECK (width > 0),
  height              INTEGER NOT NULL CHECK (height > 0),
  status              TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'archived')),
  public_url          TEXT,
  artifact_id         TEXT REFERENCES creative_artifacts(id) ON DELETE SET NULL,
  metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by          TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (creative_version_id, width, height)
);

CREATE INDEX IF NOT EXISTS creative_size_variants_workspace_idx
  ON creative_size_variants(workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS creative_size_variants_version_idx
  ON creative_size_variants(creative_version_id, created_at DESC);

CREATE INDEX IF NOT EXISTS creative_size_variants_status_idx
  ON creative_size_variants(workspace_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS video_renditions (
  id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  workspace_id        TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  creative_version_id TEXT NOT NULL REFERENCES creative_versions(id) ON DELETE CASCADE,
  artifact_id         TEXT REFERENCES creative_artifacts(id) ON DELETE SET NULL,
  label               TEXT NOT NULL,
  width               INTEGER,
  height              INTEGER,
  bitrate_kbps        INTEGER,
  codec               TEXT,
  mime_type           TEXT,
  status              TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('draft', 'processing', 'active', 'paused', 'archived', 'failed')),
  is_source           BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order          INTEGER NOT NULL DEFAULT 0,
  public_url          TEXT,
  storage_key         TEXT,
  size_bytes          BIGINT,
  metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS video_renditions_workspace_idx
  ON video_renditions(workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS video_renditions_version_idx
  ON video_renditions(creative_version_id, sort_order ASC, created_at DESC);

CREATE INDEX IF NOT EXISTS video_renditions_status_idx
  ON video_renditions(workspace_id, status, created_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'creative_tag_bindings_variant_id_fkey'
  ) THEN
    ALTER TABLE creative_tag_bindings
      ADD CONSTRAINT creative_tag_bindings_variant_id_fkey
      FOREIGN KEY (creative_size_variant_id)
      REFERENCES creative_size_variants(id)
      ON DELETE CASCADE;
  END IF;
END $$;
