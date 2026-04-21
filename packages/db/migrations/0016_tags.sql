-- 0016_tags.sql
-- Add additional columns to ad_tags if not already present
ALTER TABLE ad_tags ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE ad_tags ADD COLUMN IF NOT EXISTS targeting JSONB NOT NULL DEFAULT '{}';
ALTER TABLE ad_tags ADD COLUMN IF NOT EXISTS frequency_cap INT;
ALTER TABLE ad_tags ADD COLUMN IF NOT EXISTS frequency_cap_window TEXT CHECK (frequency_cap_window IN ('hour','day','week'));
ALTER TABLE ad_tags ADD COLUMN IF NOT EXISTS geo_targets TEXT[] DEFAULT '{}';
ALTER TABLE ad_tags ADD COLUMN IF NOT EXISTS device_targets TEXT[] DEFAULT '{}';

CREATE TABLE IF NOT EXISTS tag_pixels (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tag_id      UUID NOT NULL REFERENCES ad_tags(id) ON DELETE CASCADE,
  pixel_type  TEXT NOT NULL CHECK (pixel_type IN ('impression','click','viewability','custom')),
  url         TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS tag_pixels_tag_idx ON tag_pixels(tag_id);
