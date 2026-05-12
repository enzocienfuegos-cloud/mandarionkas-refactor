import test from 'node:test';
import assert from 'node:assert/strict';

import {
  checkCreativeUploadRateLimit,
  getCreativeUploadRateLimitConfig,
} from './upload-rate-limit.mjs';

test('getCreativeUploadRateLimitConfig reads upload env config with safe defaults', () => {
  assert.deepEqual(getCreativeUploadRateLimitConfig({
    uploadRateLimitMax: 12,
    uploadRateLimitWindowMs: 30_000,
  }), {
    limit: 12,
    windowMs: 30_000,
  });

  assert.deepEqual(getCreativeUploadRateLimitConfig({
    uploadRateLimitMax: 0,
    uploadRateLimitWindowMs: Number.NaN,
  }), {
    limit: 20,
    windowMs: 60_000,
  });
});

test('checkCreativeUploadRateLimit scopes buckets by user, workspace, and IP', async () => {
  const calls = [];
  const result = await checkCreativeUploadRateLimit({
    client: { name: 'client' },
    env: { uploadRateLimitMax: 7, uploadRateLimitWindowMs: 45_000 },
    headers: { 'x-real-ip': '203.0.113.50' },
    userId: 'user-1',
    workspaceId: 'workspace-1',
    checkRateLimit: async (client, options) => {
      calls.push({ client, options });
      return { ok: true, remaining: 6 };
    },
  });

  assert.equal(result.ok, true);
  assert.deepEqual(calls, [
    {
      client: { name: 'client' },
      options: {
        headers: { 'x-real-ip': '203.0.113.50' },
        key: 'creative-upload:user-1:workspace-1',
        limit: 7,
        windowMs: 45_000,
      },
    },
  ]);
});
