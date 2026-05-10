-- Migration 0028: add 'unavailable' to video_renditions status enum
--
-- regenerateVideoRenditions() inserts status='unavailable' for profiles
-- whose source resolution is below the minimum required for transcoding.
-- This is semantically distinct from 'failed' (which means the job ran
-- and errored). The constraint was missing this value.

ALTER TABLE video_renditions
  DROP CONSTRAINT video_renditions_status_check,
  ADD CONSTRAINT video_renditions_status_check
    CHECK (status IN (
      'draft',
      'queued',
      'processing',
      'active',
      'paused',
      'archived',
      'failed',
      'unavailable'
    ));
