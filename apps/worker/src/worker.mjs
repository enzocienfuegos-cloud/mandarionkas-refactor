// apps/worker/src/worker.mjs
//
// S49: Migrated from manual polling loop to pg-boss event-driven dispatch.
//
// Before S49:
//   while (!shuttingDown) {
//     await runCycle();      // sequential: maintenance → derivatives → transcode → …
//     await sleep(30_000);   // up to 30s latency before processing a new job
//   }
//
// After S49:
//   pg-boss registers work() handlers for each queue.
//   When a job is inserted, pg-boss wakes the handler immediately via
//   PostgreSQL LISTEN/NOTIFY — no polling latency.
//   A lightweight heartbeat loop sends a maintenance job every 30s so
//   the reconciler (stall detection, cap pruning, session cleanup) keeps running.
//
// S51 fix — notify-listener bridge:
//   The API inserts into video_transcode_jobs but never calls boss.send().
//   A PostgreSQL trigger (migration 0027) fires pg_notify('smx.transcode-video')
//   on every pending INSERT. notify-listener.mjs receives this NOTIFY on a
//   dedicated persistent pg.Client and calls sendTranscodeJob() → boss.send().
//   This keeps the API fully decoupled from pgboss.
//
// The existing job functions (runTranscodeVideoJob, etc.) are unchanged.
// pg-boss wraps them: it handles retry scheduling, deduplication, and
// dead-letter archiving. The platform tables (video_transcode_jobs, etc.)
// remain the canonical job state for the API and UI.
//
// Graceful shutdown:
//   SIGTERM/SIGINT → set shuttingDown → stopNotifyListener → boss.stop({ graceful: true })
//   pg-boss waits for in-flight handlers to complete before stopping.

import { runGenerateImageDerivativesJob } from './jobs/generate-image-derivatives.mjs';
import { runExtractMetadataJob } from './jobs/extract-metadata.mjs';
import { runGenerateThumbnailsJob } from './jobs/generate-thumbnails.mjs';
import { runMaintenanceJob } from './jobs/maintenance.mjs';
import { runTranscodeVideoJob } from './jobs/transcode-video.mjs';
import {
  ensureBossStarted,
  getBoss,
  stopBoss,
  sendMaintenanceJob,
  QUEUE,
} from './queue.mjs';
import { startNotifyListener, stopNotifyListener } from './notify-listener.mjs';

// ─── Logging ──────────────────────────────────────────────────────────────────

function log(level, payload) {
  const line = JSON.stringify({ level, time: new Date().toISOString(), service: 'smx-worker', ...payload });
  level === 'error' ? console.error(line) : console.log(line);
}

// ─── Handler wrappers ─────────────────────────────────────────────────────────
// pg-boss work() handlers receive a job object { id, name, data, ... }.
// We ignore the job data here because the actual job state lives in the
// platform tables — the pg-boss job is just a dispatch signal.

async function handleTranscodeVideo(job) {
  log('info', { event: 'job_start', queue: QUEUE.TRANSCODE_VIDEO, pgbossJobId: job.id });
  const result = await runTranscodeVideoJob();
  log('info', { event: 'job_done', queue: QUEUE.TRANSCODE_VIDEO, pgbossJobId: job.id, ...result });
}

async function handleImageDerivatives(job) {
  log('info', { event: 'job_start', queue: QUEUE.IMAGE_DERIVATIVES, pgbossJobId: job.id });
  const result = await runGenerateImageDerivativesJob();
  log('info', { event: 'job_done', queue: QUEUE.IMAGE_DERIVATIVES, pgbossJobId: job.id, ...result });
}

async function handleMaintenance(job) {
  log('info', { event: 'job_start', queue: QUEUE.MAINTENANCE, pgbossJobId: job.id });
  const result = await runMaintenanceJob();
  log('info', { event: 'job_done', queue: QUEUE.MAINTENANCE, pgbossJobId: job.id, ...result });
}

// ─── Work registration ────────────────────────────────────────────────────────

async function registerHandlers() {
  const boss = getBoss();

  // Transcode video: one concurrent job per worker instance
  await boss.work(QUEUE.TRANSCODE_VIDEO, { teamSize: 1, teamConcurrency: 1 }, handleTranscodeVideo);

  // Image derivatives: up to 2 concurrent per worker (CPU/IO bound, not memory-heavy)
  await boss.work(QUEUE.IMAGE_DERIVATIVES, { teamSize: 2, teamConcurrency: 2 }, handleImageDerivatives);

  // Maintenance: at most 1 at a time
  await boss.work(QUEUE.MAINTENANCE, { teamSize: 1, teamConcurrency: 1 }, handleMaintenance);

  log('info', { event: 'handlers_registered', queues: Object.values(QUEUE) });
}

// ─── Maintenance heartbeat ────────────────────────────────────────────────────
// Sends a maintenance job every 30s. pg-boss deduplicates within 25s windows
// (singletonSeconds: 25 in queue.mjs) so only one runs per window even
// if multiple workers are running.

function startMaintenanceHeartbeat(intervalMs = 30_000) {
  let timer = null;

  async function tick() {
    try {
      await sendMaintenanceJob();
    } catch (e) {
      log('warn', { event: 'heartbeat_error', message: e?.message });
    }
  }

  function schedule() {
    timer = setTimeout(async () => {
      await tick();
      if (timer !== null) schedule();
    }, intervalMs);
  }

  // Fire once immediately, then on interval
  tick();
  schedule();

  return () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  let shuttingDown = false;
  let stopHeartbeat = () => {};

  const handleShutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    log('info', { event: 'shutdown_initiated', signal });

    stopHeartbeat();

    // Stop the NOTIFY listener before pg-boss so the bridge doesn't fire
    // sendTranscodeJob() against a stopping boss instance.
    try {
      await stopNotifyListener();
    } catch (e) {
      log('error', { event: 'notify_listener_stop_error', message: e?.message });
    }

    try {
      await stopBoss();
      log('info', { event: 'shutdown_complete' });
    } catch (e) {
      log('error', { event: 'shutdown_error', message: e?.message });
    }

    process.exit(0);
  };

  process.on('SIGTERM', () => void handleShutdown('SIGTERM'));
  process.on('SIGINT',  () => void handleShutdown('SIGINT'));

  log('info', { event: 'worker_boot' });

  // 1. Start pg-boss (creates/migrates pgboss schema on first run)
  await ensureBossStarted();

  // 2. Register job handlers
  await registerHandlers();

  // 3. Start the NOTIFY→pgboss bridge listener
  //    Must be after ensureBossStarted() so sendTranscodeJob() can call getBoss().
  await startNotifyListener();
  log('info', { event: 'notify_listener_started', channel: 'smx.transcode-video' });

  // 4. Start maintenance heartbeat
  const heartbeatIntervalMs = Number(process.env.WORKER_POLL_INTERVAL_MS ?? 30_000);
  stopHeartbeat = startMaintenanceHeartbeat(heartbeatIntervalMs);

  log('info', {
    event: 'worker_ready',
    queues:             Object.values(QUEUE),
    heartbeatIntervalMs,
  });

  // Keep process alive — pg-boss event loop handles everything
  await new Promise(() => {});
}

main().catch((error) => {
  console.error(JSON.stringify({
    level: 'error',
    time: new Date().toISOString(),
    service: 'smx-worker',
    event: 'worker_fatal',
    message: error?.message ?? 'Worker failed',
    stack: error?.stack,
  }));
  process.exitCode = 1;
});
