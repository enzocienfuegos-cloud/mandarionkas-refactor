import test from 'node:test';
import assert from 'node:assert/strict';
import { runTranscodeVideoJobWithDeps } from './transcode-video.mjs';

function createFakeClient() {
  return {
    released: false,
    release() {
      this.released = true;
    },
  };
}

function createBaseJob() {
  return {
    id: 'job_video_1',
    asset_id: 'asset_video_1',
    workspace_id: 'workspace_1',
    input: {
      publicUrl: 'https://cdn.example.com/source.mp4',
      storageKey: 'uploads/source.mp4',
    },
  };
}

function createDeps(overrides = {}) {
  const calls = {
    skip: [],
    patch: [],
    complete: [],
    fail: [],
    upload: [],
    ffmpeg: [],
    info: [],
    warn: [],
    error: [],
  };
  const client = createFakeClient();
  return {
    calls,
    client,
    deps: {
      getPool: () => ({
        connect: async () => client,
      }),
      closeAllPools: async () => undefined,
      claimNextAssetProcessingJob: async () => createBaseJob(),
      completeAssetProcessingJob: async (_client, payload) => {
        calls.complete.push(payload);
        return payload;
      },
      failAssetProcessingJob: async (_client, payload) => {
        calls.fail.push(payload);
        return payload;
      },
      patchAssetMetadata: async (_client, payload) => {
        calls.patch.push(payload);
        return true;
      },
      skipAssetProcessingJob: async (_client, payload) => {
        calls.skip.push(payload);
        return payload;
      },
      logInfo: (payload) => {
        calls.info.push(payload);
      },
      logWarn: (payload) => {
        calls.warn.push(payload);
      },
      logError: (payload) => {
        calls.error.push(payload);
      },
      commandExists: async () => true,
      runFfmpeg: async (binary, args, cwd) => {
        calls.ffmpeg.push({ binary, args, cwd });
      },
      uploadFileToR2: async (_source, payload) => {
        calls.upload.push(payload);
      },
      mkdtemp: async () => '/tmp/smx-video-test',
      rm: async () => undefined,
      stat: async (filePath) => ({
        size: filePath.endsWith('.jpg') ? 3456 : 456789,
      }),
      ...overrides,
    },
  };
}

test('video transcode job marks asset as planned when transcoding is disabled', async () => {
  const { deps, calls, client } = createDeps();
  const result = await runTranscodeVideoJobWithDeps(
    {
      DATABASE_URL: 'postgres://example',
      TRANSCODE_VIDEO_ENABLED: 'false',
    },
    deps,
  );

  assert.deepEqual(result, { processed: 0, skipped: false });
  assert.equal(calls.skip.length, 1);
  assert.equal(calls.patch.at(-1)?.metadataPatch?.optimization?.video?.status, 'planned');
  assert.equal(client.released, true);
});

test('video transcode job marks asset as blocked when ffmpeg is unavailable', async () => {
  const { deps, calls } = createDeps({
    commandExists: async () => false,
  });
  const result = await runTranscodeVideoJobWithDeps(
    {
      DATABASE_URL: 'postgres://example',
      TRANSCODE_VIDEO_ENABLED: 'true',
      R2_ENDPOINT: 'https://r2.example.com',
      R2_BUCKET: 'bucket',
      R2_ACCESS_KEY_ID: 'key',
      R2_SECRET_ACCESS_KEY: 'secret',
    },
    deps,
  );

  assert.deepEqual(result, { processed: 0, skipped: false });
  assert.equal(calls.skip.length, 1);
  assert.equal(calls.patch.at(-1)?.metadataPatch?.optimization?.video?.status, 'blocked');
});

test('video transcode job completes and writes derivative metadata', async () => {
  const { deps, calls } = createDeps();
  const result = await runTranscodeVideoJobWithDeps(
    {
      DATABASE_URL: 'postgres://example',
      TRANSCODE_VIDEO_ENABLED: 'true',
      R2_ENDPOINT: 'https://r2.example.com',
      R2_BUCKET: 'bucket',
      R2_ACCESS_KEY_ID: 'key',
      R2_SECRET_ACCESS_KEY: 'secret',
      FFMPEG_BIN: 'ffmpeg',
    },
    deps,
  );

  assert.deepEqual(result, { processed: 1, skipped: false });
  assert.equal(calls.complete.length, 1);
  assert.equal(calls.ffmpeg.length, 4);
  assert.equal(calls.upload.length, 4);

  const finalPatch = calls.patch.at(-1);
  assert.equal(finalPatch?.metadataPatch?.optimization?.video?.status, 'completed');
  assert.equal(finalPatch?.metadataPatch?.derivatives?.low?.src, 'https://cdn.example.com/source-low.mp4');
  assert.equal(finalPatch?.metadataPatch?.derivatives?.mid?.src, 'https://cdn.example.com/source-mid.mp4');
  assert.equal(finalPatch?.metadataPatch?.derivatives?.high?.src, 'https://cdn.example.com/source-high.mp4');
  assert.equal(finalPatch?.metadataPatch?.derivatives?.poster?.src, 'https://cdn.example.com/source-poster.jpg');
  assert.equal(finalPatch?.metadataPatch?.optimizedUrl, 'https://cdn.example.com/source-high.mp4');
  assert.equal(finalPatch?.posterSrc, 'https://cdn.example.com/source-poster.jpg');
  assert.equal(finalPatch?.thumbnailUrl, 'https://cdn.example.com/source-poster.jpg');
});

test('video transcode job requeues transient failures before max attempts', async () => {
  const { deps, calls } = createDeps({
    claimNextAssetProcessingJob: async () => ({
      ...createBaseJob(),
      attempts: 1,
      max_attempts: 3,
    }),
    runFfmpeg: async () => {
      throw new Error('temporary ffmpeg failure');
    },
  });

  const result = await runTranscodeVideoJobWithDeps(
    {
      DATABASE_URL: 'postgres://example',
      TRANSCODE_VIDEO_ENABLED: 'true',
      R2_ENDPOINT: 'https://r2.example.com',
      R2_BUCKET: 'bucket',
      R2_ACCESS_KEY_ID: 'key',
      R2_SECRET_ACCESS_KEY: 'secret',
      FFMPEG_BIN: 'ffmpeg',
    },
    deps,
  );

  assert.deepEqual(result, { processed: 0, skipped: false });
  assert.equal(calls.fail.length, 1);
  assert.equal(calls.fail[0]?.final, false);
  assert.equal(calls.fail[0]?.retryDelaySeconds, 30);
  assert.equal(calls.patch.at(-1)?.metadataPatch?.optimization?.video?.status, 'queued');
  assert.equal(calls.patch.at(-1)?.metadataPatch?.optimization?.video?.retryCount, 1);
});
