CREATE TABLE IF NOT EXISTS studio_projects (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  owner_user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  state             JSONB NOT NULL DEFAULT '{}',
  brand_id          TEXT,
  brand_name        TEXT,
  campaign_name     TEXT,
  access_scope      TEXT NOT NULL DEFAULT 'client' CHECK (access_scope IN ('private', 'client', 'reviewers')),
  archived_at       TIMESTAMPTZ,
  canvas_preset_id  TEXT,
  scene_count       INTEGER NOT NULL DEFAULT 0,
  widget_count      INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS studio_projects_workspace_idx ON studio_projects(workspace_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS studio_projects_owner_idx ON studio_projects(owner_user_id);

CREATE TABLE IF NOT EXISTS studio_asset_folders (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id   UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  owner_user_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  parent_id      UUID REFERENCES studio_asset_folders(id) ON DELETE CASCADE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS studio_asset_folders_workspace_idx ON studio_asset_folders(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS studio_asset_folders_parent_idx ON studio_asset_folders(parent_id);

CREATE TABLE IF NOT EXISTS studio_assets (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id               UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  owner_user_id              UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  folder_id                  UUID REFERENCES studio_asset_folders(id) ON DELETE SET NULL,
  name                       TEXT NOT NULL,
  kind                       TEXT NOT NULL DEFAULT 'other',
  src                        TEXT,
  mime_type                  TEXT,
  source_type                TEXT,
  storage_mode               TEXT,
  storage_key                TEXT,
  public_url                 TEXT,
  optimized_url              TEXT,
  quality_preference         TEXT,
  processing_status          TEXT,
  processing_message         TEXT,
  processing_attempts        INTEGER,
  processing_last_retry_at   TIMESTAMPTZ,
  processing_next_retry_at   TIMESTAMPTZ,
  derivatives                JSONB,
  origin_url                 TEXT,
  fingerprint                TEXT,
  size_bytes                 BIGINT,
  width                      INTEGER,
  height                     INTEGER,
  duration_ms                INTEGER,
  poster_src                 TEXT,
  thumbnail_url              TEXT,
  font_family                TEXT,
  tags                       JSONB NOT NULL DEFAULT '[]',
  access_scope               TEXT NOT NULL DEFAULT 'client' CHECK (access_scope IN ('private', 'client')),
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS studio_assets_workspace_idx ON studio_assets(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS studio_assets_folder_idx ON studio_assets(folder_id);
CREATE INDEX IF NOT EXISTS studio_assets_owner_idx ON studio_assets(owner_user_id);
