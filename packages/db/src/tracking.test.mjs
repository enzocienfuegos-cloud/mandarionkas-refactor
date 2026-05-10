import test from 'node:test';
import assert from 'node:assert/strict';

import {
  flushTrackerBatch,
  recordClick,
  recordEngagement,
  recordImpression,
} from './tracking.mjs';

function createFakePool({ throwOnQuery = false } = {}) {
  const queries = [];
  const fakeClient = {
    released: false,
    queries: [],
    async query(sql, params) {
      if (throwOnQuery) throw new Error('simulated DB error');
      this.queries.push({ sql: sql.trim().replace(/\s+/g, ' '), params });
      return { rows: [], rowCount: 0 };
    },
    release() {
      this.released = true;
    },
  };

  return {
    queries,
    fakeClient,
    async query(sql, params) {
      if (throwOnQuery) throw new Error('simulated DB error');
      const entry = { sql: sql.trim().replace(/\s+/g, ' '), params };
      queries.push(entry);
      return { rows: [], rowCount: 0 };
    },
    async connect() {
      return fakeClient;
    },
  };
}

test('recordImpression writes an upsert for a valid tagId', async () => {
  const pool = createFakePool();
  const result = await recordImpression(pool, 'tag-abc');
  assert.equal(result, true);
  assert.equal(pool.queries.length, 1);
  assert.ok(pool.queries[0].sql.includes('insert into tag_daily_stats'));
  assert.deepEqual(pool.queries[0].params, ['tag-abc']);
});

test('recordClick writes an upsert for a valid tagId', async () => {
  const pool = createFakePool();
  const result = await recordClick(pool, 'tag-click');
  assert.equal(result, true);
  assert.equal(pool.queries.length, 1);
  assert.ok(pool.queries[0].sql.includes('clicks'));
});

test('recordEngagement drops unknown events', async () => {
  const pool = createFakePool();
  const result = await recordEngagement(pool, 'tag-1', 'unknownEvent');
  assert.equal(result, false);
  assert.equal(pool.queries.length, 0);
});

test('recordEngagement writes valid vast events', async () => {
  const pool = createFakePool();
  const result = await recordEngagement(pool, 'tag-1', 'midpoint', 15000);
  assert.equal(result, true);
  assert.equal(pool.queries.length, 1);
  assert.deepEqual(pool.queries[0].params, ['tag-1', 'midpoint', 15000]);
});

test('write helpers swallow database errors', async () => {
  const pool = createFakePool({ throwOnQuery: true });
  assert.equal(await recordImpression(pool, 'tag-1'), false);
  assert.equal(await recordClick(pool, 'tag-1'), false);
  assert.equal(await recordEngagement(pool, 'tag-1', 'start'), false);
});

test('flushTrackerBatch writes impressions, clicks and engagements in one transaction', async () => {
  const pool = createFakePool();
  const batch = {
    impressions: new Map([['tag-a', 10], ['tag-b', 5]]),
    clicks: new Map([['tag-a', 2]]),
    engagements: new Map([
      ['tag-a:start', { tagId: 'tag-a', eventType: 'start', count: 8, durationMs: 0 }],
      ['tag-a:complete', { tagId: 'tag-a', eventType: 'complete', count: 6, durationMs: 30000 }],
    ]),
  };

  const result = await flushTrackerBatch(pool, batch);
  assert.equal(result.impressions, 15);
  assert.equal(result.clicks, 2);
  assert.equal(result.engagements, 14);
  assert.ok(pool.fakeClient.queries.some((q) => q.sql.startsWith('BEGIN')));
  assert.ok(pool.fakeClient.queries.some((q) => q.sql.startsWith('COMMIT')));
});

test('flushTrackerBatch returns zeros for an empty batch', async () => {
  const pool = createFakePool();
  const result = await flushTrackerBatch(pool, {
    impressions: new Map(),
    clicks: new Map(),
    engagements: new Map(),
  });
  assert.deepEqual(result, { impressions: 0, clicks: 0, engagements: 0 });
});
