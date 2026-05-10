-- Migration 0027: NOTIFY trigger for video_transcode_jobs
--
-- Problem this solves:
--   The API inserts rows into video_transcode_jobs (status='pending') but
--   never calls boss.send(). The worker listens exclusively on pgboss queues
--   via pg-boss work() handlers — it never polls video_transcode_jobs directly.
--   Result: jobs sit in the table forever, worker stays idle, pgboss monitor
--   shows created:0.
--
-- Solution:
--   A PostgreSQL trigger fires pg_notify('smx.transcode-video', creative_version_id)
--   on every INSERT of a pending row. The worker's notify-listener.mjs picks this
--   up and calls sendTranscodeJob(creativeVersionId), which enqueues to pgboss.
--
-- Why a trigger and not boss.send() in the API:
--   - Zero coupling: API stays agnostic to pgboss. No new imports, no new deps.
--   - Resilient: fires even if job is inserted by scripts, seeds, or migrations.
--   - Atomic: NOTIFY fires inside the same transaction as the INSERT.
--     If the INSERT rolls back, the NOTIFY is also suppressed automatically.
--   - Single responsibility: each layer does one thing.

CREATE OR REPLACE FUNCTION notify_video_transcode_pending()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only notify for freshly-inserted pending jobs.
  -- The worker's notify-listener bridges this to pgboss.
  IF NEW.status = 'pending' THEN
    PERFORM pg_notify('smx.transcode-video', NEW.creative_version_id::text);
  END IF;
  RETURN NEW;
END;
$$;

-- Drop before recreating so this migration is idempotent on re-runs.
DROP TRIGGER IF EXISTS trg_video_transcode_notify ON video_transcode_jobs;

CREATE TRIGGER trg_video_transcode_notify
  AFTER INSERT ON video_transcode_jobs
  FOR EACH ROW
  EXECUTE FUNCTION notify_video_transcode_pending();
