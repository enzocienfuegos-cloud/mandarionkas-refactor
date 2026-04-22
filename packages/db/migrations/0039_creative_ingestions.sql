CREATE TABLE IF NOT EXISTS creative_ingestions (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id       UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  created_by         UUID REFERENCES users(id) ON DELETE SET NULL,
  creative_id        UUID REFERENCES creatives(id) ON DELETE SET NULL,
  creative_version_id UUID REFERENCES creative_versions(id) ON DELETE SET NULL,
  source_kind        TEXT NOT NULL CHECK (source_kind IN ('html5_zip', 'video_mp4')),
  status             TEXT NOT NULL DEFAULT 'uploaded' CHECK (status IN (
    'uploaded',
    'processing',
    'validated',
    'failed',
    'published'
  )),
  original_filename  TEXT NOT NULL,
  mime_type          TEXT,
  size_bytes         BIGINT,
  storage_key        TEXT,
  public_url         TEXT,
  checksum           TEXT,
  metadata           JSONB NOT NULL DEFAULT '{}',
  validation_report  JSONB NOT NULL DEFAULT '{}',
  error_code         TEXT,
  error_detail       TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS creative_ingestions_workspace_idx
  ON creative_ingestions(workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS creative_ingestions_status_idx
  ON creative_ingestions(workspace_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS creative_ingestions_source_idx
  ON creative_ingestions(workspace_id, source_kind, created_at DESC);
