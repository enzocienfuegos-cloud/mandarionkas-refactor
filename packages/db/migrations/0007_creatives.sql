-- 0007_creatives.sql
CREATE TABLE IF NOT EXISTS creatives (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  type              TEXT NOT NULL DEFAULT 'image' CHECK (type IN ('image','video','html','vast','native')),
  file_url          TEXT,
  file_size         BIGINT,
  mime_type         TEXT,
  width             INT,
  height            INT,
  duration_ms       INT,
  click_url         TEXT,
  metadata          JSONB NOT NULL DEFAULT '{}',
  approval_status   TEXT NOT NULL DEFAULT 'draft' CHECK (approval_status IN ('draft','pending_review','approved','rejected','archived')),
  reviewed_by       UUID REFERENCES users(id),
  reviewed_at       TIMESTAMPTZ,
  review_notes      TEXT,
  transcode_status  TEXT NOT NULL DEFAULT 'pending' CHECK (transcode_status IN ('pending','processing','done','failed')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS creatives_workspace_idx ON creatives(workspace_id);
CREATE INDEX IF NOT EXISTS creatives_approval_status_idx ON creatives(workspace_id, approval_status);
CREATE INDEX IF NOT EXISTS creatives_transcode_status_idx ON creatives(transcode_status);
