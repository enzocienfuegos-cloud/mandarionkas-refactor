// packages/db/src/job-dispatch.mjs
//
// S49: Job dispatch helper for use from apps/api.
//
// The API needs to enqueue jobs when user actions happen (e.g. creative publish
// triggers a transcode). But the API cannot import from apps/worker (circular
// dependency). Instead, this module inserts a notification record directly into
// the pgboss.job table using raw SQL — the same format pg-boss uses internally.
//
// This avoids importing pg-boss into @smx/db or @smx/api. The worker's pg-boss
// instance picks up the job via LISTEN/NOTIFY automatically.
//
// Alternatively, the API can use the existing asset_processing_jobs / video_transcode_jobs
// tables (already in @smx/db) and the worker polls those. This module provides a
// direct pg-boss insert path for lower latency when pg-boss is the active queue.
//
// Design: best-effort dispatch. If pg-boss schema is not yet present (e.g. first
// deploy before migration 0026), the insert fails gracefully — the worker's
// heartbeat maintenance job will pick up any stalled platform jobs.

/**
 * Dispatch a transcode-video job to the pg-boss queue.
 * The worker's handler will claim from video_transcode_jobs.
 *
 * Safe to call from apps/api routes. Fails silently if pg-boss schema is absent.
 *
 * @param {object} pool - pg pool from @smx/db
 * @param {string} creativeVersionId
 */
export async function dispatchTranscodeJob(pool, creativeVersionId) {
  if (!creativeVersionId) return false;
  try {
    await pool.query(
      `INSERT INTO pgboss.job (name, data, singleton_key, retry_limit, retry_backoff, expire_in)
       VALUES (
         'smx.transcode-video',
         $1::jsonb,
         $2,
         3,
         true,
         interval '15 minutes'
       )
       ON CONFLICT (name, singleton_key)
         WHERE state < 'active'
       DO NOTHING`,
      [JSON.stringify({ creativeVersionId }), creativeVersionId],
    );
    return true;
  } catch {
    // pg-boss schema may not exist yet — not fatal.
    return false;
  }
}

/**
 * Dispatch an image-derivatives job to the pg-boss queue.
 * Safe to call from apps/api. Fails silently if pg-boss schema is absent.
 *
 * @param {object} pool - pg pool
 * @param {string} assetId
 */
export async function dispatchImageDerivativesJob(pool, assetId) {
  if (!assetId) return false;
  try {
    await pool.query(
      `INSERT INTO pgboss.job (name, data, singleton_key, retry_limit, retry_backoff, expire_in)
       VALUES (
         'smx.image-derivatives',
         $1::jsonb,
         $2,
         3,
         true,
         interval '10 minutes'
       )
       ON CONFLICT (name, singleton_key)
         WHERE state < 'active'
       DO NOTHING`,
      [JSON.stringify({ assetId }), assetId],
    );
    return true;
  } catch {
    return false;
  }
}
