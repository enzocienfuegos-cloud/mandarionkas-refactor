CREATE TABLE IF NOT EXISTS creatives (
  id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  workspace_id     TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  type             TEXT NOT NULL DEFAULT 'display' CHECK (type IN ('vast_video', 'display', 'native', 'image', 'video', 'vast')),
  file_url         TEXT,
  thumbnail_url    TEXT,
  file_size        BIGINT,
  mime_type        TEXT,
  width            INT,
  height           INT,
  duration_ms      INT,
  click_url        TEXT,
  metadata         JSONB NOT NULL DEFAULT '{}'::jsonb,
  approval_status  TEXT NOT NULL DEFAULT 'draft' CHECK (approval_status IN ('draft', 'pending_review', 'approved', 'rejected', 'archived')),
  transcode_status TEXT NOT NULL DEFAULT 'pending' CHECK (transcode_status IN ('pending', 'processing', 'ready', 'failed')),
  reviewed_by      TEXT REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at      TIMESTAMPTZ,
  review_notes     TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS creatives_workspace_idx ON creatives(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS creatives_status_idx ON creatives(workspace_id, approval_status, created_at DESC);
CREATE INDEX IF NOT EXISTS creatives_type_idx ON creatives(workspace_id, type, created_at DESC);

CREATE TABLE IF NOT EXISTS creative_versions (
  id                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  workspace_id      TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  creative_id       TEXT NOT NULL REFERENCES creatives(id) ON DELETE CASCADE,
  version_number    INTEGER NOT NULL CHECK (version_number > 0),
  source_kind       TEXT NOT NULL CHECK (source_kind IN ('legacy', 'studio_export', 'html5_zip', 'video_mp4', 'image_upload', 'native_upload', 'vast_wrapper')),
  serving_format    TEXT NOT NULL CHECK (serving_format IN ('display_html', 'display_image', 'vast_video', 'native', 'vast_wrapper')),
  status            TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'processing', 'pending_review', 'approved', 'rejected', 'archived')),
  public_url        TEXT,
  entry_path        TEXT,
  mime_type         TEXT,
  width             INT,
  height            INT,
  duration_ms       INT,
  file_size         BIGINT,
  metadata          JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by        TEXT REFERENCES users(id) ON DELETE SET NULL,
  reviewed_by       TEXT REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at       TIMESTAMPTZ,
  review_notes      TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (creative_id, version_number)
);

CREATE INDEX IF NOT EXISTS creative_versions_workspace_idx ON creative_versions(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS creative_versions_creative_idx ON creative_versions(creative_id, version_number DESC);
CREATE INDEX IF NOT EXISTS creative_versions_status_idx ON creative_versions(workspace_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS creative_artifacts (
  id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  workspace_id        TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  creative_version_id TEXT NOT NULL REFERENCES creative_versions(id) ON DELETE CASCADE,
  kind                TEXT NOT NULL CHECK (kind IN ('legacy_asset', 'source_zip', 'published_html', 'published_asset', 'video_mp4', 'poster', 'manifest', 'thumbnail')),
  storage_key         TEXT,
  public_url          TEXT,
  mime_type           TEXT,
  size_bytes          BIGINT,
  checksum            TEXT,
  metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS creative_artifacts_version_idx ON creative_artifacts(creative_version_id, created_at DESC);
CREATE INDEX IF NOT EXISTS creative_artifacts_workspace_idx ON creative_artifacts(workspace_id, created_at DESC);

CREATE TABLE IF NOT EXISTS creative_ingestions (
  id                 TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  workspace_id       TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  created_by         TEXT REFERENCES users(id) ON DELETE SET NULL,
  creative_id        TEXT REFERENCES creatives(id) ON DELETE SET NULL,
  creative_version_id TEXT REFERENCES creative_versions(id) ON DELETE SET NULL,
  source_kind        TEXT NOT NULL CHECK (source_kind IN ('html5_zip', 'video_mp4')),
  status             TEXT NOT NULL DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'processing', 'validated', 'failed', 'published')),
  original_filename  TEXT NOT NULL,
  mime_type          TEXT,
  size_bytes         BIGINT,
  storage_key        TEXT,
  public_url         TEXT,
  checksum           TEXT,
  metadata           JSONB NOT NULL DEFAULT '{}'::jsonb,
  validation_report  JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_code         TEXT,
  error_detail       TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS creative_ingestions_workspace_idx ON creative_ingestions(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS creative_ingestions_status_idx ON creative_ingestions(workspace_id, status, created_at DESC);
