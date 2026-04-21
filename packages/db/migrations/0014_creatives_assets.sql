-- 0014_creatives_assets.sql
CREATE TABLE IF NOT EXISTS creative_assets (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creative_id   UUID NOT NULL REFERENCES creatives(id) ON DELETE CASCADE,
  asset_type    TEXT NOT NULL CHECK (asset_type IN ('original','transcoded','thumbnail','companion')),
  file_url      TEXT NOT NULL,
  file_size     BIGINT,
  mime_type     TEXT,
  width         INT,
  height        INT,
  bitrate_kbps  INT,
  duration_ms   INT,
  storage_key   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS creative_assets_creative_idx ON creative_assets(creative_id);
CREATE INDEX IF NOT EXISTS creative_assets_type_idx ON creative_assets(creative_id, asset_type);
