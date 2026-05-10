-- Migration 0032: soft fingerprint columns in impression_events

ALTER TABLE impression_events
  ADD COLUMN IF NOT EXISTS sf_timezone TEXT,
  ADD COLUMN IF NOT EXISTS sf_language TEXT,
  ADD COLUMN IF NOT EXISTS sf_screen TEXT,
  ADD COLUMN IF NOT EXISTS sf_touch BOOLEAN,
  ADD COLUMN IF NOT EXISTS sf_mem_gb NUMERIC(4,1),
  ADD COLUMN IF NOT EXISTS sf_cpu_cores SMALLINT;

ALTER TABLE impression_events
  ADD COLUMN IF NOT EXISTS soft_fingerprint TEXT
    GENERATED ALWAYS AS (
      md5(COALESCE(sf_timezone, '') || '|' || COALESCE(sf_screen, '') || '|' || COALESCE(sf_language, '') || '|' || COALESCE(sf_touch::text, ''))
    ) STORED;

CREATE INDEX IF NOT EXISTS impression_events_soft_fp_idx
  ON impression_events (soft_fingerprint)
  WHERE soft_fingerprint IS NOT NULL;
