-- 0012_ab_experiments.sql
CREATE TABLE IF NOT EXISTS ab_experiments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  tag_id        UUID REFERENCES ad_tags(id) ON DELETE SET NULL,
  name          TEXT NOT NULL,
  description   TEXT,
  status        TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','running','paused','completed')),
  traffic_pct   NUMERIC(5,2) NOT NULL DEFAULT 100 CHECK (traffic_pct > 0 AND traffic_pct <= 100),
  started_at    TIMESTAMPTZ,
  ended_at      TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ab_variants (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id   UUID NOT NULL REFERENCES ab_experiments(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  creative_id     UUID REFERENCES creatives(id) ON DELETE SET NULL,
  weight          NUMERIC(5,2) NOT NULL DEFAULT 50 CHECK (weight > 0),
  impressions     BIGINT NOT NULL DEFAULT 0,
  clicks          BIGINT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ab_experiments_workspace_idx ON ab_experiments(workspace_id);
CREATE INDEX IF NOT EXISTS ab_experiments_tag_idx ON ab_experiments(tag_id);
CREATE INDEX IF NOT EXISTS ab_variants_experiment_idx ON ab_variants(experiment_id);
