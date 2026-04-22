CREATE TABLE IF NOT EXISTS creative_versions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  creative_id       UUID NOT NULL REFERENCES creatives(id) ON DELETE CASCADE,
  version_number    INTEGER NOT NULL CHECK (version_number > 0),
  source_kind       TEXT NOT NULL CHECK (source_kind IN (
    'legacy',
    'studio_export',
    'html5_zip',
    'video_mp4',
    'image_upload',
    'native_upload',
    'vast_wrapper'
  )),
  serving_format    TEXT NOT NULL CHECK (serving_format IN (
    'display_html',
    'display_image',
    'vast_video',
    'native',
    'vast_wrapper'
  )),
  status            TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft',
    'processing',
    'pending_review',
    'approved',
    'rejected',
    'archived'
  )),
  public_url        TEXT,
  entry_path        TEXT,
  mime_type         TEXT,
  width             INT,
  height            INT,
  duration_ms       INT,
  file_size         BIGINT,
  metadata          JSONB NOT NULL DEFAULT '{}',
  created_by        UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at       TIMESTAMPTZ,
  review_notes      TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (creative_id, version_number)
);

CREATE INDEX IF NOT EXISTS creative_versions_workspace_idx
  ON creative_versions(workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS creative_versions_creative_idx
  ON creative_versions(creative_id, version_number DESC);

CREATE INDEX IF NOT EXISTS creative_versions_status_idx
  ON creative_versions(workspace_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS creative_artifacts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  creative_version_id UUID NOT NULL REFERENCES creative_versions(id) ON DELETE CASCADE,
  kind                TEXT NOT NULL CHECK (kind IN (
    'legacy_asset',
    'source_zip',
    'published_html',
    'published_asset',
    'video_mp4',
    'poster',
    'manifest',
    'thumbnail'
  )),
  storage_key         TEXT,
  public_url          TEXT,
  mime_type           TEXT,
  size_bytes          BIGINT,
  checksum            TEXT,
  metadata            JSONB NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS creative_artifacts_version_idx
  ON creative_artifacts(creative_version_id, created_at DESC);

CREATE INDEX IF NOT EXISTS creative_artifacts_workspace_idx
  ON creative_artifacts(workspace_id, created_at DESC);

CREATE TABLE IF NOT EXISTS tag_bindings (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  tag_id              UUID NOT NULL REFERENCES ad_tags(id) ON DELETE CASCADE,
  creative_version_id UUID NOT NULL REFERENCES creative_versions(id) ON DELETE CASCADE,
  status              TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'paused', 'archived')),
  weight              INT NOT NULL DEFAULT 1 CHECK (weight > 0),
  start_at            TIMESTAMPTZ,
  end_at              TIMESTAMPTZ,
  created_by          UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tag_id, creative_version_id)
);

CREATE INDEX IF NOT EXISTS tag_bindings_tag_idx
  ON tag_bindings(tag_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS tag_bindings_version_idx
  ON tag_bindings(creative_version_id);

INSERT INTO creative_versions (
  workspace_id,
  creative_id,
  version_number,
  source_kind,
  serving_format,
  status,
  public_url,
  mime_type,
  width,
  height,
  duration_ms,
  file_size,
  metadata,
  created_at,
  updated_at
)
SELECT
  c.workspace_id,
  c.id,
  1,
  'legacy',
  CASE
    WHEN c.type = 'html' THEN 'display_html'
    WHEN c.type = 'native' THEN 'native'
    WHEN c.type IN ('video', 'vast') THEN 'vast_video'
    ELSE 'display_image'
  END,
  CASE
    WHEN c.transcode_status IN ('pending', 'processing') THEN 'processing'
    ELSE c.approval_status
  END,
  c.file_url,
  c.mime_type,
  c.width,
  c.height,
  c.duration_ms,
  c.file_size,
  jsonb_build_object('legacyCreativeId', c.id, 'legacyType', c.type),
  c.created_at,
  c.updated_at
FROM creatives c
WHERE NOT EXISTS (
  SELECT 1
  FROM creative_versions cv
  WHERE cv.creative_id = c.id
);

INSERT INTO creative_artifacts (
  workspace_id,
  creative_version_id,
  kind,
  storage_key,
  public_url,
  mime_type,
  size_bytes,
  metadata,
  created_at
)
SELECT
  cv.workspace_id,
  cv.id,
  'legacy_asset',
  ca.storage_key,
  COALESCE(ca.file_url, cv.public_url),
  ca.mime_type,
  ca.file_size,
  jsonb_build_object('legacyCreativeAssetId', ca.id, 'assetType', ca.asset_type),
  ca.created_at
FROM creative_assets ca
JOIN creative_versions cv
  ON cv.creative_id = ca.creative_id
 AND cv.source_kind = 'legacy'
WHERE NOT EXISTS (
  SELECT 1
  FROM creative_artifacts a
  WHERE a.creative_version_id = cv.id
    AND a.kind = 'legacy_asset'
    AND a.public_url IS NOT DISTINCT FROM ca.file_url
);

INSERT INTO tag_bindings (
  workspace_id,
  tag_id,
  creative_version_id,
  status,
  weight,
  created_at,
  updated_at
)
SELECT
  t.workspace_id,
  tc.tag_id,
  cv.id,
  CASE
    WHEN t.status = 'paused' THEN 'paused'
    WHEN t.status = 'archived' THEN 'archived'
    ELSE 'active'
  END,
  tc.weight,
  tc.created_at,
  tc.created_at
FROM tag_creatives tc
JOIN ad_tags t
  ON t.id = tc.tag_id
JOIN creative_versions cv
  ON cv.creative_id = tc.creative_id
 AND cv.source_kind = 'legacy'
WHERE NOT EXISTS (
  SELECT 1
  FROM tag_bindings tb
  WHERE tb.tag_id = tc.tag_id
    AND tb.creative_version_id = cv.id
);
