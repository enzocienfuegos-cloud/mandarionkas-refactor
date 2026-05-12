-- Migration 0040: persist creative and variant dimensions on tracker events.
--
-- Forward-looking reporting can attribute creative and variant delivery exactly
-- when the serving layer passes these ids through tracker URLs.

ALTER TABLE impression_events
  ADD COLUMN IF NOT EXISTS creative_size_variant_id TEXT;

ALTER TABLE click_events
  ADD COLUMN IF NOT EXISTS creative_id TEXT,
  ADD COLUMN IF NOT EXISTS creative_size_variant_id TEXT;

CREATE INDEX IF NOT EXISTS impression_events_tag_creative_ts_idx
  ON impression_events (tag_id, creative_id, timestamp DESC)
  WHERE creative_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS impression_events_tag_variant_ts_idx
  ON impression_events (tag_id, creative_size_variant_id, timestamp DESC)
  WHERE creative_size_variant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS click_events_tag_creative_ts_idx
  ON click_events (tag_id, creative_id, timestamp DESC)
  WHERE creative_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS click_events_tag_variant_ts_idx
  ON click_events (tag_id, creative_size_variant_id, timestamp DESC)
  WHERE creative_size_variant_id IS NOT NULL;
