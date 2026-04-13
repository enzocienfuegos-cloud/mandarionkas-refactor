import { runGenerateThumbnailsJob } from './jobs/generate-thumbnails.mjs';
import { runExtractMetadataJob } from './jobs/extract-metadata.mjs';
import { runMaintenanceJob } from './jobs/maintenance.mjs';

async function main() {
  console.log(JSON.stringify({ level: 'info', service: 'smx-worker', message: 'Worker booted.' }));
  await runMaintenanceJob();
  await runGenerateThumbnailsJob();
  await runExtractMetadataJob();
}

main().catch((error) => {
  console.error(JSON.stringify({ level: 'error', service: 'smx-worker', message: error?.message || 'Worker failed', stack: error?.stack }));
  process.exitCode = 1;
});
