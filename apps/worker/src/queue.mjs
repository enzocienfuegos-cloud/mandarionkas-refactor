// apps/worker/src/queue.mjs
//
// S49: pg-boss singleton for the SMX worker.
//
// Design decisions:
//
// 1. pg-boss vs polling
//    The existing worker uses a manual polling loop (sleep 30s → claim → process).
//    pg-boss replaces this with event-driven job dispatch: pg-boss listens on
//    PostgreSQL LISTEN/NOTIFY and wakes workers immediately when a job is inserted.
//    This eliminates up to 30s of latency on new job submission.
//
// 2. Two-layer job state
//    pg-boss manages scheduling, retry, and deduplication.
//    The platform's own tables (video_transcode_jobs, asset_processing_jobs) remain
//    the canonical state source for the UI and API.
//    When pg-boss fires a job handler, the handler still claims from the platform
//    table using FOR UPDATE SKIP LOCKED — ensuring multi-instance safety even if
//    pg-boss fires the handler on multiple workers simultaneously.
//
// 3. Job names → handlers
//    Each queue name maps 1:1 to an existing job function:
//      'smx.transcode-video'       → runTranscodeVideoJob
//      'smx.image-derivatives'     → runGenerateImageDerivativesJob
//      'smx.maintenance'           → runMaintenanceJob
//
// 4. Deduplication
//    pg-boss deduplicates by singletonKey within a time window.
//    For maintenance: only one active maintenance job at a time (singletonKey = 'maintenance').
//    For transcode: singletonKey = creative_version_id prevents duplicate enqueues.
//
// 5. Retry + backoff
//    pg-boss handles retry with configurable expBackoff.
//    The platform's video_transcode_jobs table tracks attempt counts independently.
//
// 6. Dead-letter queue
//    Failed jobs beyond maxAttempts go to pgboss.archive.
//    The maintenance job reconciler handles stalled platform jobs independently.
//
// Usage:
//   import { getBoss, ensureBossStarted } from './queue.mjs';
//   await ensureBossStarted();
//   const boss = getBoss();
//   await boss.send('smx.transcode-video', { creativeVersionId }, { singletonKey: creativeVersionId });

import PgBoss from 'pg-boss';

// ─── Queue names ───────────────────────────────────────────────────────────────

export const QUEUE = Object.freeze({
  TRANSCODE_VIDEO:    'smx.transcode-video',
  IMAGE_DERIVATIVES:  'smx.image-derivatives',
  MAINTENANCE:        'smx.maintenance',
});

// ─── Singleton ────────────────────────────────────────────────────────────────

let boss = null;
let startPromise = null;

/**
 * Create and start the pg-boss instance.
 * Safe to call multiple times — only starts once.
 *
 * @param {object} [source=process.env]
 * @returns {Promise<PgBoss>}
 */
export async function ensureBossStarted(source = process.env) {
  if (boss) return boss;
  if (startPromise) return startPromise;

  const connectionString = String(source.DATABASE_POOL_URL || source.DATABASE_URL || '').trim();
  if (!connectionString) {
    throw new Error('pg-boss: DATABASE_URL or DATABASE_POOL_URL is required');
  }

  const archiveCompletedAfterSeconds = Number(source.PGBOSS_ARCHIVE_COMPLETED_AFTER_SECONDS ?? 3600);   // 1h
  const archiveFailedAfterSeconds    = Number(source.PGBOSS_ARCHIVE_FAILED_AFTER_SECONDS    ?? 86400);  // 24h
  const deleteAfterDays              = Number(source.PGBOSS_DELETE_AFTER_DAYS               ?? 7);

  startPromise = (async () => {
    const instance = new PgBoss({
      connectionString,
      ssl: { rejectUnauthorized: false },

      // Schema: use pgboss (created by migration 0026)
      schema: 'pgboss',

      // Archive completed jobs after 1h, failed after 24h
      archiveCompletedAfterSeconds,
      archiveFailedAfterSeconds,

      // Purge archived jobs after 7 days
      deleteAfterDays,

      // Monitoring interval (emit 'monitor-states' events)
      monitorStateIntervalSeconds: 30,

      // Max connections pg-boss uses from the pool
      max: 3,
    });

    instance.on('error', (err) => {
      console.error(JSON.stringify({
        level: 'error',
        time: new Date().toISOString(),
        service: 'smx-worker',
        event: 'pgboss_error',
        message: err?.message ?? String(err),
        stack: err?.stack,
      }));
    });

    instance.on('monitor-states', (states) => {
      // Log aggregate job state counts every 30s
      console.log(JSON.stringify({
        level: 'info',
        time: new Date().toISOString(),
        service: 'smx-worker',
        event: 'pgboss_monitor',
        ...states,
      }));
    });

    await instance.start();
    boss = instance;

    console.log(JSON.stringify({
      level: 'info',
      time: new Date().toISOString(),
      service: 'smx-worker',
      event: 'pgboss_started',
    }));

    return instance;
  })();

  return startPromise;
}

/**
 * Get the current pg-boss instance.
 * Throws if ensureBossStarted() has not been called.
 */
export function getBoss() {
  if (!boss) throw new Error('pg-boss has not been started. Call ensureBossStarted() first.');
  return boss;
}

/**
 * Gracefully stop pg-boss (drains in-flight handlers before shutting down).
 * Call during SIGTERM/SIGINT handling.
 */
export async function stopBoss() {
  if (!boss) return;
  try {
    await boss.stop({ graceful: true, timeout: 10_000 });
  } catch (e) {
    console.error(JSON.stringify({
      level: 'error',
      time: new Date().toISOString(),
      service: 'smx-worker',
      event: 'pgboss_stop_error',
      message: e?.message,
    }));
  } finally {
    boss = null;
    startPromise = null;
  }
}

// ─── Job send helpers ─────────────────────────────────────────────────────────

/**
 * Enqueue a transcode-video job.
 * Deduplicated by creativeVersionId — only one active job per version.
 *
 * @param {string} creativeVersionId
 * @param {object} [opts]
 */
export async function sendTranscodeJob(creativeVersionId, opts = {}) {
  const b = getBoss();
  return b.send(QUEUE.TRANSCODE_VIDEO, { creativeVersionId }, {
    singletonKey:      creativeVersionId,
    retryLimit:        3,
    retryDelay:        60,     // seconds before first retry
    expireInSeconds:   900,    // job expires if not started within 15 min
    retryBackoff:      true,   // exponential: 60s, 120s, 240s
    ...opts,
  });
}

/**
 * Enqueue an image-derivatives job.
 * Deduplicated by assetId.
 *
 * @param {string} assetId
 * @param {object} [opts]
 */
export async function sendImageDerivativesJob(assetId, opts = {}) {
  const b = getBoss();
  return b.send(QUEUE.IMAGE_DERIVATIVES, { assetId }, {
    singletonKey:      assetId,
    retryLimit:        3,
    retryDelay:        30,
    expireInSeconds:   600,
    retryBackoff:      true,
    ...opts,
  });
}

/**
 * Enqueue the maintenance job.
 * Only one maintenance job runs at a time (singletonKey = 'global').
 *
 * @param {object} [opts]
 */
export async function sendMaintenanceJob(opts = {}) {
  const b = getBoss();
  return b.send(QUEUE.MAINTENANCE, {}, {
    singletonKey:      'global',
    singletonSeconds:  25,     // deduplicate within 25s windows (matches 30s poll)
    retryLimit:        1,
    expireInSeconds:   120,
    ...opts,
  });
}
