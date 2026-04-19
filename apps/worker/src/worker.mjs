import { runGenerateImageDerivativesJob } from './jobs/generate-image-derivatives.mjs';
import { runTranscodeVideoJob } from './jobs/transcode-video.mjs';
import { runMaintenanceJob } from './jobs/maintenance.mjs';
import { runGenerateThumbnailsJob } from './jobs/generate-thumbnails.mjs';
import { runExtractMetadataJob } from './jobs/extract-metadata.mjs';
import { logError, logInfo, logWarn } from '@smx/config/logger';

// ─── Configuration ────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = parseInt(process.env.WORKER_POLL_INTERVAL_MS || '5000', 10);
const MAINTENANCE_INTERVAL_MS = parseInt(process.env.WORKER_MAINTENANCE_INTERVAL_MS || '300000', 10); // 5 min
const SHUTDOWN_GRACE_MS = parseInt(process.env.WORKER_SHUTDOWN_GRACE_MS || '10000', 10);

// ─── Job runners ──────────────────────────────────────────────────────────────
// Each runner returns a boolean: true if it processed at least one job,
// false if the queue was empty. The poll loop uses this to decide whether
// to sleep or immediately poll again (work-stealing behaviour).

const JOB_RUNNERS = [
  { name: 'image-derivatives', run: runGenerateImageDerivativesJob },
  { name: 'video-transcode',   run: runTranscodeVideoJob },
  { name: 'generate-thumbnails', run: runGenerateThumbnailsJob },
  { name: 'extract-metadata',  run: runExtractMetadataJob },
];

// ─── Graceful shutdown ────────────────────────────────────────────────────────

let shuttingDown = false;
let activeCycle = Promise.resolve();

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  logInfo({ service: 'smx-worker', message: `${signal} received — draining current cycle.` });

  const timeout = setTimeout(() => {
    logWarn({ service: 'smx-worker', message: 'Grace period elapsed, forcing exit.' });
    process.exit(1);
  }, SHUTDOWN_GRACE_MS);

  try {
    await activeCycle;
    clearTimeout(timeout);
    logInfo({ service: 'smx-worker', message: 'Shutdown complete.' });
    process.exit(0);
  } catch (err) {
    clearTimeout(timeout);
    logError({ service: 'smx-worker', message: 'Error during shutdown drain.', error: err });
    process.exit(1);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

// ─── Poll loop ────────────────────────────────────────────────────────────────

async function runJobCycle() {
  let didWork = false;

  for (const { name, run } of JOB_RUNNERS) {
    if (shuttingDown) break;
    try {
      const result = await run();
      // Runners return { processed, skipped } when the DB queue is active,
      // undefined when they are stubs (thumbnails, metadata).
      const processed = result?.processed ?? 0;
      if (processed > 0) {
        didWork = true;
        logInfo({ service: 'smx-worker', job: name, message: 'Job completed.', processed });
      }
    } catch (err) {
      logError({ service: 'smx-worker', job: name, message: 'Unhandled error in job runner.', error: err });
      // Never crash the loop on a single job failure — continue to next runner.
    }
  }

  return didWork;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function pollLoop() {
  logInfo({ service: 'smx-worker', message: 'Poll loop started.', pollIntervalMs: POLL_INTERVAL_MS });

  while (!shuttingDown) {
    let resolve;
    activeCycle = new Promise((r) => { resolve = r; });

    try {
      const didWork = await runJobCycle();
      // If no runner found work, back off before polling again.
      // If work was found, re-poll immediately to drain the queue fast.
      if (!didWork && !shuttingDown) {
        await sleep(POLL_INTERVAL_MS);
      }
    } catch (err) {
      logError({ service: 'smx-worker', message: 'Unexpected error in poll loop.', error: err });
      await sleep(POLL_INTERVAL_MS);
    } finally {
      resolve();
    }
  }
}

// ─── Maintenance loop ─────────────────────────────────────────────────────────
// Runs on a separate timer — independent of job polling cadence.

async function maintenanceLoop() {
  logInfo({ service: 'smx-worker', message: 'Maintenance loop started.', intervalMs: MAINTENANCE_INTERVAL_MS });

  while (!shuttingDown) {
    await sleep(MAINTENANCE_INTERVAL_MS);
    if (shuttingDown) break;
    try {
      await runMaintenanceJob();
      logInfo({ service: 'smx-worker', message: 'Maintenance cycle complete.' });
    } catch (err) {
      logError({ service: 'smx-worker', message: 'Maintenance job failed.', error: err });
    }
  }
}

// ─── Boot ─────────────────────────────────────────────────────────────────────

async function main() {
  logInfo({ service: 'smx-worker', message: 'Worker booted.', node: process.version });

  // Run maintenance once immediately on boot, then on interval.
  try {
    await runMaintenanceJob();
  } catch (err) {
    logWarn({ service: 'smx-worker', message: 'Initial maintenance job failed, continuing.', error: err });
  }

  // Run both loops concurrently. Neither is awaited — they run until shutdown.
  pollLoop().catch((err) => {
    logError({ service: 'smx-worker', message: 'Poll loop terminated unexpectedly.', error: err });
    process.exit(1);
  });

  maintenanceLoop().catch((err) => {
    logError({ service: 'smx-worker', message: 'Maintenance loop terminated unexpectedly.', error: err });
    process.exit(1);
  });
}

main();
