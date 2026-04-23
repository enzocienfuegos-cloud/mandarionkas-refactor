CREATE TABLE IF NOT EXISTS creative_size_variants (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  creative_version_id UUID NOT NULL REFERENCES creative_versions(id) ON DELETE CASCADE,
  label               TEXT NOT NULL,
  width               INT NOT NULL CHECK (width > 0),
  height              INT NOT NULL CHECK (height > 0),
  status              TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'archived')),
  public_url          TEXT,
  artifact_id         UUID REFERENCES creative_artifacts(id) ON DELETE SET NULL,
  metadata            JSONB NOT NULL DEFAULT '{}',
  created_by          UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS creative_size_variants_version_idx
  ON creative_size_variants(creative_version_id, created_at DESC);

CREATE INDEX IF NOT EXISTS creative_size_variants_status_idx
  ON creative_size_variants(workspace_id, status, created_at DESC);

ALTER TABLE tag_bindings
  ADD COLUMN IF NOT EXISTS creative_size_variant_id UUID REFERENCES creative_size_variants(id) ON DELETE SET NULL;

ALTER TABLE tag_bindings
  DROP CONSTRAINT IF EXISTS tag_bindings_tag_id_creative_version_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS tag_bindings_version_unique_idx
  ON tag_bindings(tag_id, creative_version_id)
  WHERE creative_size_variant_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS tag_bindings_variant_unique_idx
  ON tag_bindings(tag_id, creative_size_variant_id)
  WHERE creative_size_variant_id IS NOT NULL;

INSERT INTO creative_size_variants (
  workspace_id,
  creative_version_id,
  label,
  width,
  height,
  status,
  public_url,
  metadata,
  created_by,
  created_at,
  updated_at
)
SELECT
  cv.workspace_id,
  cv.id,
  CASE
    WHEN cv.width IS NOT NULL AND cv.height IS NOT NULL THEN CONCAT(cv.width, 'x', cv.height)
    ELSE CONCAT('Version ', cv.version_number)
  END,
  COALESCE(cv.width, 1),
  COALESCE(cv.height, 1),
  CASE
    WHEN cv.status = 'approved' THEN 'active'
    WHEN cv.status = 'archived' THEN 'archived'
    ELSE 'draft'
  END,
  cv.public_url,
  jsonb_build_object('backfilled', true, 'source', 'creative_version'),
  cv.created_by,
  cv.created_at,
  cv.updated_at
FROM creative_versions cv
WHERE cv.width IS NOT NULL
  AND cv.height IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM creative_size_variants csv
    WHERE csv.creative_version_id = cv.id
  );
