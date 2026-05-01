import test from 'node:test';
import assert from 'node:assert/strict';
import { runTranscodeVideoJobWithDeps } from './transcode-video.mjs';

function createFakeClient() {
  return { released: false, release() { this.released = true; } };
}

function baseEnv(overrides = {}) {
  return {
    DATABASE_URL: 'postgres://fake/db',
    TRANSCODE_VIDEO_ENABLED: 'true',
    R2_ENDPOINT: 'https://fake.r2.cloudflarestorage.com',
    R2_BUCKET: 'smx-test',
    R2_ACCESS_KEY_ID: 'key',
    R2_SECRET_ACCESS_KEY: 'secret',
    R2_PUBLIC_BASE: 'https://cdn.example.com',
    ...overrides,
  };
}

function baseJob(overrides = {}) {
  return {
    id: 'job-1',
    workspace_id: 'ws-1',
    creative_version_id: 'cv-1',
    asset_id: 'asset-1',
    source_url: 'https://cdn.example.com/source.mp4',
    source_storage_key: 'workspaces/ws-1/assets/asset-1/source.mp4',
    target_plan: [
      { label: '480p', height: 480, bitrateKbps: 900 },
      { label: '720p', height: 720, bitrateKbps: 1500 },
    ],
    attempts: 1,
    max_attempts: 3,
    ...overrides,
  };
}

function createDeps(jobOverride = null, overrides = {}) {
  const calls = {
    claim: [],
    markProcessing: [],
    complete: [],
    fail: [],
    syncOutputs: [],
    ffmpeg: [],
    upload: [],
  };

  const fakeClient = createFakeClient();

  const deps = {
    _getPool: () => ({ connect: async () => fakeClient }),
    _closeAllPools: async () => undefined,
    _claimJob: async (client) => {
      const job = jobOverride ?? baseJob();
      calls.claim.push({ client });
      return job;
    },
    _markProcessing: async (_client, jobId) => {
      calls.markProcessing.push({ jobId });
      return { id: jobId, status: 'processing' };
    },
    _completeJob: async (_client, jobId, output) => {
      calls.complete.push({ jobId, output });
      return { id: jobId, status: 'done' };
    },
    _failJob: async (_client, jobId, errorMessage, errorDetail) => {
      calls.fail.push({ jobId, errorMessage, errorDetail });
      return { id: jobId, status: 'failed' };
    },
    _syncOutputs: async (_client, params) => {
      calls.syncOutputs.push(params);
      return true;
    },
    _commandExists: async () => true,
    _runFfmpeg: async (binary, args) => {
      calls.ffmpeg.push({ binary, args: args.join(' ') });
      return { stderr: '' };
    },
    _downloadSource: async () => undefined,
    _uploadToR2: async ({ storageKey, filePath, contentType }) => {
      calls.upload.push({ storageKey, filePath, contentType });
      return storageKey;
    },
    _mkdtemp: async () => `/tmp/fake-scratch-${Date.now()}`,
    _rm: async () => undefined,
    _stat: async () => ({ size: 1024 * 1024 }),
    ...overrides,
  };

  return { calls, fakeClient, deps };
}

test('skips when no DATABASE_URL', async () => {
  const { deps } = createDeps();
  const result = await runTranscodeVideoJobWithDeps({ DATABASE_URL: '' }, deps);
  assert.equal(result.skipped, true);
  assert.equal(result.processed, 0);
});

test('returns idle when no pending jobs', async () => {
  const { deps } = createDeps(null, {
    _claimJob: async () => null,
  });
  const result = await runTranscodeVideoJobWithDeps(baseEnv(), deps);
  assert.equal(result.processed, 0);
  assert.equal(result.skipped, false);
});

test('fails immediately when TRANSCODE_VIDEO_ENABLED=false', async () => {
  const { deps, calls } = createDeps();
  await runTranscodeVideoJobWithDeps(baseEnv({ TRANSCODE_VIDEO_ENABLED: 'false' }), deps);
  assert.equal(calls.fail.length, 1);
  assert.ok(calls.fail[0].errorMessage.includes('TRANSCODE_VIDEO_ENABLED'));
  assert.equal(calls.complete.length, 0);
});

test('fails immediately when ffmpeg not available', async () => {
  const { deps, calls } = createDeps(null, {
    _commandExists: async () => false,
  });
  await runTranscodeVideoJobWithDeps(baseEnv(), deps);
  assert.equal(calls.fail.length, 1);
  assert.ok(calls.fail[0].errorDetail?.reason === 'ffmpeg_missing');
});

test('fails immediately when R2 not configured', async () => {
  const { deps, calls } = createDeps();
  const env = baseEnv({ R2_ENDPOINT: '', R2_BUCKET: '' });
  await runTranscodeVideoJobWithDeps(env, deps);
  assert.equal(calls.fail.length, 1);
  assert.ok(calls.fail[0].errorDetail?.reason === 'r2_missing');
});

test('fails immediately when job has no source_url', async () => {
  const { deps, calls } = createDeps(baseJob({ source_url: '' }));
  await runTranscodeVideoJobWithDeps(baseEnv(), deps);
  assert.equal(calls.fail.length, 1);
  assert.ok(calls.fail[0].errorDetail?.reason === 'missing_source_url');
});

test('successful transcode completes and syncs outputs', async () => {
  const { deps, calls } = createDeps();
  const result = await runTranscodeVideoJobWithDeps(baseEnv(), deps);

  assert.equal(result.processed, 1);
  assert.equal(calls.claim.length, 1);
  assert.equal(calls.markProcessing.length, 1);
  assert.equal(calls.ffmpeg.length, 3);
  assert.equal(calls.upload.length, 3);
  assert.equal(calls.complete.length, 1);
  assert.equal(calls.syncOutputs.length, 1);
});

test('on ffmpeg error: fails job without completing', async () => {
  const { deps, calls } = createDeps(null, {
    _runFfmpeg: async () => { throw new Error('ffmpeg crashed'); },
  });
  const result = await runTranscodeVideoJobWithDeps(baseEnv(), deps);

  assert.equal(result.processed, 0);
  assert.equal(calls.complete.length, 0);
  assert.equal(calls.fail.length, 1);
  assert.ok(calls.fail[0].errorMessage.includes('ffmpeg crashed'));
  assert.equal(calls.syncOutputs.length, 0);
});

test('uses target_plan from job when provided', async () => {
  const { deps, calls } = createDeps(baseJob({
    target_plan: [
      { label: '1080p', height: 1080, bitrateKbps: 5000 },
    ],
  }));
  await runTranscodeVideoJobWithDeps(baseEnv(), deps);
  assert.equal(calls.ffmpeg.length, 2);
  assert.equal(calls.upload.length, 2);
});
