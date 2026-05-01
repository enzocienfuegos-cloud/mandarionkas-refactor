CREATE TABLE IF NOT EXISTS experiments (
  id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  workspace_id        TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  tag_id              TEXT NOT NULL REFERENCES ad_tags(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'paused' CHECK (status IN ('draft', 'running', 'paused', 'completed', 'archived')),
  summary             JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_id  TEXT REFERENCES users(id) ON DELETE SET NULL,
  started_at          TIMESTAMPTZ,
  ended_at            TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS experiments_workspace_idx
  ON experiments(workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS experiments_tag_idx
  ON experiments(workspace_id, tag_id, created_at DESC);

CREATE INDEX IF NOT EXISTS experiments_status_idx
  ON experiments(workspace_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS experiment_variants (
  id                       TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  workspace_id             TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  experiment_id            TEXT NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
  name                     TEXT NOT NULL,
  weight                   INTEGER NOT NULL CHECK (weight >= 0 AND weight <= 100),
  creative_size_variant_id TEXT REFERENCES creative_size_variants(id) ON DELETE SET NULL,
  metadata                 JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS experiment_variants_experiment_idx
  ON experiment_variants(experiment_id, created_at ASC);

CREATE INDEX IF NOT EXISTS experiment_variants_workspace_idx
  ON experiment_variants(workspace_id, created_at DESC);
