CREATE TABLE IF NOT EXISTS saved_audiences (
  id                       TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  workspace_id             TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  created_by               TEXT REFERENCES users(id) ON DELETE SET NULL,
  name                     TEXT NOT NULL,
  canonical_type           TEXT,
  country                  TEXT,
  site_domain              TEXT,
  region                   TEXT,
  city                     TEXT,
  segment_preset           TEXT,
  activation_template      TEXT NOT NULL DEFAULT 'full',
  campaign_id              TEXT REFERENCES campaigns(id) ON DELETE SET NULL,
  tag_id                   TEXT REFERENCES ad_tags(id) ON DELETE SET NULL,
  creative_id              TEXT REFERENCES creatives(id) ON DELETE SET NULL,
  creative_size_variant_id TEXT,
  min_impressions          INT NOT NULL DEFAULT 0,
  min_clicks               INT NOT NULL DEFAULT 0,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS saved_audiences_workspace_idx
  ON saved_audiences(workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS saved_audiences_created_by_idx
  ON saved_audiences(created_by, created_at DESC);
