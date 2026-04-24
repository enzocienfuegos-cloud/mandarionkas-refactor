CREATE TABLE IF NOT EXISTS video_renditions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  creative_version_id UUID NOT NULL REFERENCES creative_versions(id) ON DELETE CASCADE,
  artifact_id         UUID REFERENCES creative_artifacts(id) ON DELETE CASCADE,
  label               TEXT NOT NULL,
  width               INT,
  height              INT,
  bitrate_kbps        INT,
  codec               TEXT,
  mime_type           TEXT,
  status              TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'processing', 'active', 'paused', 'archived', 'failed')),
  is_source           BOOLEAN NOT NULL DEFAULT false,
  sort_order          INT NOT NULL DEFAULT 0,
  metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (creative_version_id, label)
);

CREATE INDEX IF NOT EXISTS video_renditions_version_idx
  ON video_renditions(creative_version_id, status, sort_order, created_at);

CREATE INDEX IF NOT EXISTS video_renditions_workspace_idx
  ON video_renditions(workspace_id, status, created_at DESC);
