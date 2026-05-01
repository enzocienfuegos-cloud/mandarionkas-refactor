// apps/worker/src/jobs/generate-thumbnails.mjs
//
// S47: Converted from silent stub to explicit no-op with structured logging.
//
// Thumbnail generation is not implemented — creative thumbnails are either:
//   a) Extracted from video poster frames during transcode (video_transcode_jobs, S44)
//   b) Served directly from the asset's public_url or posterSrc
//
// This job remains in the worker cycle for forward compatibility.
// When thumbnail generation is needed (e.g. for HTML5 banner previews),
// implement it here using puppeteer or a headless renderer.
//
// S48+: If thumbnail generation is added, this job should claim from a new
// `thumbnail_jobs` table (same pattern as video_transcode_jobs).

function logInfo(payload) {
  console.log(JSON.stringify({
    level: 'info',
    time: new Date().toISOString(),
    service: 'smx-worker',
    job: 'generate-thumbnails',
    ...payload,
  }));
}

export async function runGenerateThumbnailsJob(source = process.env) {
  // No-op: thumbnail generation is not yet implemented.
  // Poster frames for video creatives are handled by transcode-video.mjs (S44).
  logInfo({ status: 'noop', reason: 'not_implemented' });
  return { processed: 0, skipped: true, reason: 'not_implemented' };
}
