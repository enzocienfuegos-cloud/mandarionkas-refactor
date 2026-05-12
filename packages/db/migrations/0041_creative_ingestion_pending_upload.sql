-- Migration 0041: add 'pending_upload' as a valid creative_ingestions.status.
--
-- The upload-url endpoint now creates ingestion rows before any bytes reach R2.
-- 'pending_upload' makes that pre-proxy window explicit instead of marking the
-- row as 'uploaded' too early.

DO $$
DECLARE
  cons_name text;
BEGIN
  SELECT conname INTO cons_name
  FROM pg_constraint
  WHERE conrelid = 'creative_ingestions'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%status%';

  IF cons_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE creative_ingestions DROP CONSTRAINT %I', cons_name);
  END IF;
END $$;

ALTER TABLE creative_ingestions
  ADD CONSTRAINT creative_ingestions_status_chk
  CHECK (status IN (
    'pending_upload',
    'uploaded',
    'processing',
    'validated',
    'failed',
    'published'
  ));

ALTER TABLE creative_ingestions
  ALTER COLUMN status SET DEFAULT 'pending_upload';
