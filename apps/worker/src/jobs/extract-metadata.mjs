// apps/worker/src/jobs/extract-metadata.mjs
//
// S47: Converted from silent stub to explicit no-op with structured logging.
//
// Metadata extraction (duration, dimensions, codec, bitrate) for uploaded
// assets is not yet implemented as a background job. Currently:
//   - Video metadata is extracted during transcode (transcode-video.mjs, S44)
//     and written to video_renditions rows
//   - Image metadata (width/height) is set at upload completion time via
//     the assets API (POST /v1/assets/complete-upload)
//
// When background metadata extraction is needed (e.g. for assets uploaded
// via external URLs without prior ffprobe), implement it here using ffprobe
// or sharp, and follow the video_transcode_jobs pattern for job state.

function logInfo(payload) {
  console.log(JSON.stringify({
    level: 'info',
    time: new Date().toISOString(),
    service: 'smx-worker',
    job: 'extract-metadata',
    ...payload,
  }));
}

export async function runExtractMetadataJob(source = process.env) {
  // No-op: metadata extraction is handled at upload time or during transcode.
  logInfo({ status: 'noop', reason: 'not_implemented' });
  return { processed: 0, skipped: true, reason: 'not_implemented' };
}
