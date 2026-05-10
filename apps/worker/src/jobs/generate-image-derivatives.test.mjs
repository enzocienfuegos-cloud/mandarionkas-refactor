import test from 'node:test';
import assert from 'node:assert/strict';
import { runGenerateImageDerivativesJobWithDeps } from './generate-image-derivatives.mjs';

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
    id: 'job_1',
    asset_id: 'asset_1',
    workspace_id: 'workspace_1',
    input: {
      publicUrl: 'https://cdn.example.com/source.jpg',
      mimeType: 'image/jpeg',
      outputPlan: {
        low: { storageKey: 'low.jpg', publicUrl: 'https://cdn.example.com/low.jpg', maxWidth: 640 },
        mid: { storageKey: 'mid.jpg', publicUrl: 'https://cdn.example.com/mid.jpg', maxWidth: 1280 },
        high: { storageKey: 'high.jpg', publicUrl: 'https://cdn.example.com/high.jpg', maxWidth: 1920 },
        thumbnail: { storageKey: 'thumb.jpg', publicUrl: 'https://cdn.example.com/thumb.jpg', maxWidth: 320 },
      },
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
    info: [],
    warn: [],
  };
  const client = createFakeClient();
  return {
    calls,
    client,
    deps: {
      getPool: () => ({
        connect: async () => client,
      }),
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
      loadSharp: async () => null,
      uploadFileToR2: async (_source, payload) => {
        calls.upload.push(payload);
      },
      fetchImpl: async () => ({
        ok: true,
        arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
      }),
      mkdtemp: async () => '/tmp/smx-image-test',
      rm: async () => undefined,
      stat: async () => ({ size: 12345 }),
      readFile: async () => Buffer.from([1, 2, 3]),
      ...overrides,
    },
  };
}

test('image derivatives job marks asset as planned when generation is disabled', async () => {
  const { deps, calls, client } = createDeps();
  const result = await runGenerateImageDerivativesJobWithDeps(
    {
      DATABASE_URL: 'postgres://example',
      GENERATE_IMAGE_DERIVATIVES_ENABLED: 'false',
    },
    deps,
  );

  assert.deepEqual(result, { processed: 0, skipped: false });
  assert.equal(calls.skip.length, 1);
  assert.equal(calls.patch.at(-1)?.metadataPatch?.optimization?.image?.status, 'planned');
  assert.equal(client.released, true);
});

test('image derivatives job marks asset as blocked when sharp is unavailable', async () => {
  const { deps, calls } = createDeps();
  const result = await runGenerateImageDerivativesJobWithDeps(
    {
      DATABASE_URL: 'postgres://example',
      GENERATE_IMAGE_DERIVATIVES_ENABLED: 'true',
      R2_ENDPOINT: 'https://r2.example.com',
      R2_BUCKET: 'bucket',
      R2_ACCESS_KEY_ID: 'key',
      R2_SECRET_ACCESS_KEY: 'secret',
    },
    deps,
  );

  assert.deepEqual(result, { processed: 0, skipped: false });
  assert.equal(calls.skip.length, 1);
  assert.equal(calls.patch.at(-1)?.metadataPatch?.optimization?.image?.status, 'blocked');
});

test('image derivatives job completes and writes derivative metadata', async () => {
  const sharpStub = (input) => ({
    metadata: async () => (Buffer.isBuffer(input) ? { width: 1920, height: 1080 } : { width: 640, height: 360 }),
    rotate() {
      return this;
    },
    resize() {
      return this;
    },
    jpeg() {
      return this;
    },
    png() {
      return this;
    },
    webp() {
      return this;
    },
    async toFile() {
      return undefined;
    },
  });

  const { deps, calls } = createDeps({
    loadSharp: async () => sharpStub,
  });

  const result = await runGenerateImageDerivativesJobWithDeps(
    {
      DATABASE_URL: 'postgres://example',
      GENERATE_IMAGE_DERIVATIVES_ENABLED: 'true',
      R2_ENDPOINT: 'https://r2.example.com',
      R2_BUCKET: 'bucket',
      R2_ACCESS_KEY_ID: 'key',
      R2_SECRET_ACCESS_KEY: 'secret',
    },
    deps,
  );

  assert.deepEqual(result, { processed: 1, skipped: false });
  assert.equal(calls.complete.length, 1);
  assert.equal(calls.upload.length, 4);
  const finalPatch = calls.patch.at(-1);
  assert.equal(finalPatch?.metadataPatch?.optimization?.image?.status, 'completed');
  assert.equal(finalPatch?.metadataPatch?.derivatives?.low?.src, 'https://cdn.example.com/low.jpg');
  assert.equal(finalPatch?.thumbnailUrl, 'https://cdn.example.com/thumb.jpg');
});

test('image derivatives job requeues transient failures before max attempts', async () => {
  const { deps, calls } = createDeps({
    claimNextAssetProcessingJob: async () => ({
      ...createBaseJob(),
      attempts: 1,
      max_attempts: 3,
    }),
    loadSharp: async () => {
      throw new Error('temporary sharp failure');
    },
  });

  const result = await runGenerateImageDerivativesJobWithDeps(
    {
      DATABASE_URL: 'postgres://example',
      GENERATE_IMAGE_DERIVATIVES_ENABLED: 'true',
      R2_ENDPOINT: 'https://r2.example.com',
      R2_BUCKET: 'bucket',
      R2_ACCESS_KEY_ID: 'key',
      R2_SECRET_ACCESS_KEY: 'secret',
    },
    deps,
  );

  assert.deepEqual(result, { processed: 0, skipped: false });
  assert.equal(calls.fail.length, 1);
  assert.equal(calls.fail[0]?.final, false);
  assert.equal(calls.fail[0]?.retryDelaySeconds, 15);
  assert.equal(calls.patch.at(-1)?.metadataPatch?.optimization?.image?.status, 'queued');
  assert.equal(calls.patch.at(-1)?.metadataPatch?.optimization?.image?.retryCount, 1);
});
