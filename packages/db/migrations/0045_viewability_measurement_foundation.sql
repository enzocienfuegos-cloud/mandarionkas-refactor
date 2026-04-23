ALTER TABLE impression_events
  ADD COLUMN IF NOT EXISTS viewability_status TEXT NOT NULL DEFAULT 'unmeasured',
  ADD COLUMN IF NOT EXISTS viewability_method TEXT,
  ADD COLUMN IF NOT EXISTS viewability_duration_ms INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'impression_events_viewability_status_check'
  ) THEN
    ALTER TABLE impression_events
      ADD CONSTRAINT impression_events_viewability_status_check
      CHECK (viewability_status IN ('unmeasured', 'measured', 'viewable', 'undetermined'));
  END IF;
END $$;

ALTER TABLE tag_daily_stats
  ADD COLUMN IF NOT EXISTS measured_imps BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS undetermined_imps BIGINT NOT NULL DEFAULT 0;

ALTER TABLE tag_site_daily_stats
  ADD COLUMN IF NOT EXISTS measured_imps BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS undetermined_imps BIGINT NOT NULL DEFAULT 0;

ALTER TABLE tag_country_daily_stats
  ADD COLUMN IF NOT EXISTS measured_imps BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS undetermined_imps BIGINT NOT NULL DEFAULT 0;

ALTER TABLE creative_variant_daily_stats
  ADD COLUMN IF NOT EXISTS viewable_imps BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS measured_imps BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS undetermined_imps BIGINT NOT NULL DEFAULT 0;
