import { runGenerateThumbnailsJob } from './jobs/generate-thumbnails.mjs';
import { runGenerateImageDerivativesJob } from './jobs/generate-image-derivatives.mjs';
import { runExtractMetadataJob } from './jobs/extract-metadata.mjs';
import { runMaintenanceJob } from './jobs/maintenance.mjs';
import { runTranscodeVideoJob } from './jobs/transcode-video.mjs';

function parseIntervalMs(source = process.env) {
  const raw = Number.parseInt(String(source.WORKER_POLL_INTERVAL_MS || '30000'), 10);
  return Number.isFinite(raw) && raw > 0 ? raw : 30000;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runJob(name, fn) {
  try {
    await fn();
  } catch (error) {
    console.error(JSON.stringify({
      level: 'error',
      service: 'smx-worker',
      job: name,
      message: error?.message || 'Job failed',
      stack: error?.stack,
    }));
  }
}

async function runCycle() {
  await runJob('maintenance', runMaintenanceJob);
  await runJob('image-derivatives', runGenerateImageDerivativesJob);
  await runJob('transcode-video', runTranscodeVideoJob);
  await runJob('generate-thumbnails', runGenerateThumbnailsJob);
  await runJob('extract-metadata', runExtractMetadataJob);
}

async function main() {
  const pollIntervalMs = parseIntervalMs();
  let shuttingDown = false;
  const handleShutdown = () => {
    shuttingDown = true;
  };

  process.on('SIGTERM', handleShutdown);
  process.on('SIGINT', handleShutdown);

  console.log(JSON.stringify({ level: 'info', service: 'smx-worker', message: 'Worker booted.' }));
  console.log(JSON.stringify({
    level: 'info',
    service: 'smx-worker',
    message: 'Worker polling loop started.',
    pollIntervalMs,
  }));

  while (!shuttingDown) {
    await runCycle();
    if (!shuttingDown) {
      await sleep(pollIntervalMs);
    }
  }

  console.log(JSON.stringify({ level: 'info', service: 'smx-worker', message: 'Worker shutting down.' }));
}

main().catch((error) => {
  console.error(JSON.stringify({ level: 'error', service: 'smx-worker', message: error?.message || 'Worker failed', stack: error?.stack }));
  process.exitCode = 1;
});
