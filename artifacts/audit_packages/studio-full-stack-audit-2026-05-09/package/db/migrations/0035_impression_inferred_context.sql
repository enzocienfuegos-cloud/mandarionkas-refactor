-- Migration 0035: inferred content context column

ALTER TABLE impression_events
  ADD COLUMN IF NOT EXISTS inferred_context TEXT;

CREATE INDEX IF NOT EXISTS impression_events_inferred_context_idx
  ON impression_events (inferred_context)
  WHERE inferred_context IS NOT NULL AND inferred_context <> 'unknown';
