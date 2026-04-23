ALTER TABLE impression_events
  ADD COLUMN IF NOT EXISTS creative_size_variant_id UUID REFERENCES creative_size_variants(id) ON DELETE SET NULL;

ALTER TABLE click_events
  ADD COLUMN IF NOT EXISTS creative_size_variant_id UUID REFERENCES creative_size_variants(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS impression_events_variant_idx ON impression_events(creative_size_variant_id);
CREATE INDEX IF NOT EXISTS click_events_variant_idx ON click_events(creative_size_variant_id);

CREATE TABLE IF NOT EXISTS creative_variant_daily_stats (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creative_size_variant_id UUID NOT NULL REFERENCES creative_size_variants(id) ON DELETE CASCADE,
  date                    DATE NOT NULL,
  impressions             BIGINT NOT NULL DEFAULT 0,
  clicks                  BIGINT NOT NULL DEFAULT 0,
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(creative_size_variant_id, date)
);

CREATE INDEX IF NOT EXISTS creative_variant_daily_stats_variant_idx
  ON creative_variant_daily_stats(creative_size_variant_id);
CREATE INDEX IF NOT EXISTS creative_variant_daily_stats_date_idx
  ON creative_variant_daily_stats(date DESC);
CREATE INDEX IF NOT EXISTS creative_variant_daily_stats_variant_date_idx
  ON creative_variant_daily_stats(creative_size_variant_id, date DESC);
