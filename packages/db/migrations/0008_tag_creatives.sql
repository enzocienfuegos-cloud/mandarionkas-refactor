-- 0008_tag_creatives.sql
CREATE TABLE IF NOT EXISTS tag_creatives (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tag_id        UUID NOT NULL REFERENCES ad_tags(id) ON DELETE CASCADE,
  creative_id   UUID NOT NULL REFERENCES creatives(id) ON DELETE CASCADE,
  weight        INT NOT NULL DEFAULT 1 CHECK (weight > 0),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tag_id, creative_id)
);

CREATE INDEX IF NOT EXISTS tag_creatives_tag_idx ON tag_creatives(tag_id);
CREATE INDEX IF NOT EXISTS tag_creatives_creative_idx ON tag_creatives(creative_id);
