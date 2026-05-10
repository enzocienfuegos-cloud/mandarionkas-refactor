-- Migration 0026: pg-boss schema bootstrap
--
-- S49: pg-boss manages its own schema (pgboss.*) via its internal migrations.
-- This migration simply ensures the pgboss schema exists and records the
-- intent — pg-boss will create/update its tables when PgBoss.start() is called.
--
-- pg-boss uses:
--   pgboss.version     — schema version tracking
--   pgboss.job         — job queue with retry, delay, deduplication
--   pgboss.archive     — completed/failed jobs (configurable retention)
--   pgboss.schedule    — cron-like recurring jobs
--   pgboss.subscription — queue subscriptions
--
-- The pgboss schema is separate from the public schema used by the platform.
-- It does NOT interfere with asset_processing_jobs or video_transcode_jobs.
--
-- NOTE: pg-boss calls PgBoss.start() which runs its own internal migration.
-- This SQL migration only creates the schema if it doesn't exist, so pg-boss
-- has a landing zone on first deploy.

CREATE SCHEMA IF NOT EXISTS pgboss;

-- Grant usage to the application database user (adjust role name if needed)
-- The application's DATABASE_URL user must have CREATE privileges in pgboss schema.
-- If using a restricted role, run manually:
--   GRANT USAGE ON SCHEMA pgboss TO <app_user>;
--   GRANT ALL ON ALL TABLES IN SCHEMA pgboss TO <app_user>;
