ALTER TABLE creatives
  DROP CONSTRAINT IF EXISTS creatives_transcode_status_check;

ALTER TABLE creatives
  ADD CONSTRAINT creatives_transcode_status_check
  CHECK (transcode_status IN ('pending', 'queued', 'processing', 'ready', 'failed'));
