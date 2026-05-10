import test from 'node:test';
import assert from 'node:assert/strict';

import { buildVastStorageKey, createR2Client } from './client.mjs';
import { publishStaticVastProfiles } from '../../db/src/vast.mjs';

test('buildVastStorageKey builds the expected path', () => {
  assert.equal(buildVastStorageKey('tag-123', 'default'), 'vast/tags/tag-123/default.xml');
  assert.equal(buildVastStorageKey('tag-abc', 'basis'), 'vast/tags/tag-abc/basis.xml');
});

test('buildVastStorageKey throws when inputs are missing', () => {
  assert.throws(() => buildVastStorageKey('', 'default'), /tagId and profile are required/);
  assert.throws(() => buildVastStorageKey('tag-1', ''), /tagId and profile are required/);
});

test('createR2Client returns a null client when config is incomplete', async () => {
  const r2 = createR2Client({ publicBaseUrl: 'https://cdn.example.com' });
  assert.equal(r2.isConfigured, false);
  const result = await r2.putXml('vast/tags/tag-1/default.xml', '<VAST/>');
  assert.equal(result.publicUrl, 'https://cdn.example.com/vast/tags/tag-1/default.xml');
});

test('configured client builds public URLs deterministically', () => {
  const r2 = createR2Client({
    endpoint: 'https://abc.r2.cloudflarestorage.com',
    bucket: 'smx-assets',
    accessKeyId: 'key-id',
    secretAccessKey: 'secret',
    publicBaseUrl: 'https://cdn.smx.studio/',
  });
  assert.equal(r2.isConfigured, true);
  assert.equal(r2.toPublicUrl('/vast/tags/t/default.xml'), 'https://cdn.smx.studio/vast/tags/t/default.xml');
});

function createFakeVastPool({ tagFormat = 'vast' } = {}) {
  const queries = [];
  return {
    queries,
    async query(sql, params) {
      const normalized = sql.trim().replace(/\s+/g, ' ');
      queries.push({ sql: normalized, params });

      if (normalized.includes('information_schema')) {
        return { rows: [{ '?column?': 1 }] };
      }
      if (normalized.includes('FROM ad_tags t')) {
        return {
          rows: [{
            id: 'tag-static-1',
            workspace_id: 'ws-1',
            campaign_id: 'camp-1',
            name: 'Test VAST Tag',
            format: tagFormat,
            status: 'active',
            click_url: 'https://example.com/click',
            impression_url: '',
            targeting: {},
            created_at: new Date(),
            updated_at: new Date(),
            campaign_name: 'Test Campaign',
            campaign_metadata: {},
            vast_version: '4.2',
            vast_wrapper: false,
            vast_url: null,
            format_metadata: {},
          }],
        };
      }
      if (normalized.includes('FROM creative_tag_bindings')) return { rows: [] };
      if (normalized.includes('FROM tag_pixels')) return { rows: [] };
      if (normalized.includes('video_renditions')) return { rows: [] };
      if (normalized.includes('INSERT INTO tag_format_configs')) return { rows: [] };
      return { rows: [] };
    },
  };
}

function createFakeR2({ shouldFail = false } = {}) {
  const uploads = [];
  return {
    isConfigured: true,
    uploads,
    async putXml(storageKey, xml, opts) {
      if (shouldFail) throw new Error('simulated R2 upload failure');
      uploads.push({ storageKey, xml, opts });
      return {
        storageKey,
        publicUrl: `https://cdn.example.com/${storageKey}`,
        contentLength: Buffer.byteLength(xml, 'utf8'),
      };
    },
    async exists() {
      return false;
    },
    async delete() {},
    toPublicUrl(key) {
      return `https://cdn.example.com/${key}`;
    },
  };
}

test('publishStaticVastProfiles uploads to R2 when provided', async () => {
  const pool = createFakeVastPool();
  const r2 = createFakeR2();
  const state = await publishStaticVastProfiles(
    pool,
    { tagId: 'tag-static-1', baseUrl: 'https://api.example.com', profiles: ['default'] },
    { r2 },
  );

  assert.equal(r2.uploads.length, 1);
  assert.equal(state.staticProfileStatus.default.storageKey, 'vast/tags/tag-static-1/default.xml');
  assert.equal(state.staticProfileStatus.default.uploadedToR2, true);
  assert.equal(state.manifest.uploadedToR2, true);
});

test('publishStaticVastProfiles falls back cleanly without R2', async () => {
  const pool = createFakeVastPool();
  const state = await publishStaticVastProfiles(
    pool,
    { tagId: 'tag-static-1', baseUrl: 'https://api.example.com', profiles: ['default'] },
  );

  assert.equal(state.staticProfileStatus.default.storageKey, null);
  assert.equal(state.staticProfileStatus.default.uploadedToR2, false);
  assert.equal(state.manifest.uploadedToR2, false);
});

test('publishStaticVastProfiles does not persist a partial state on R2 failure', async () => {
  const pool = createFakeVastPool();
  const r2 = createFakeR2({ shouldFail: true });

  await assert.rejects(
    () => publishStaticVastProfiles(pool, { tagId: 'tag-static-1', baseUrl: 'https://api.example.com', profiles: ['default'] }, { r2 }),
    /simulated R2 upload failure/,
  );

  const upsertCalls = pool.queries.filter((query) => query.sql.includes('INSERT INTO tag_format_configs'));
  assert.equal(upsertCalls.length, 0);
});
