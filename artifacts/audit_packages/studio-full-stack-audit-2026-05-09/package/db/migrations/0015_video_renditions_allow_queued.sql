ALTER TABLE video_renditions
  DROP CONSTRAINT IF EXISTS video_renditions_status_check;

ALTER TABLE video_renditions
  ADD CONSTRAINT video_renditions_status_check
  CHECK (status IN ('draft', 'queued', 'processing', 'active', 'paused', 'archived', 'failed'));
