ALTER TABLE saved_audiences
  ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tag_id UUID REFERENCES ad_tags(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS creative_id UUID REFERENCES creatives(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS creative_size_variant_id UUID REFERENCES creative_size_variants(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS saved_audiences_campaign_idx ON saved_audiences(campaign_id);
CREATE INDEX IF NOT EXISTS saved_audiences_tag_idx ON saved_audiences(tag_id);
CREATE INDEX IF NOT EXISTS saved_audiences_creative_idx ON saved_audiences(creative_id);
CREATE INDEX IF NOT EXISTS saved_audiences_variant_idx ON saved_audiences(creative_size_variant_id);
