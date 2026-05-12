import test from 'node:test';
import assert from 'node:assert/strict';

import { runTrackerFlushJob } from './tracker-flush-job.mjs';

function createFakePool() {
  const queries = [];
  const fakeClient = {
    async query(sql, params) {
      queries.push({ sql: sql.trim().replace(/\s+/g, ' '), params });
      if (/DELETE FROM tracker_events_staging/i.test(sql)) return { rowCount: 3, rows: [] };
      if (/DELETE FROM tracker_engagement_staging/i.test(sql)) return { rowCount: 4, rows: [] };
      return { rowCount: 0, rows: [] };
    },
    release() {},
  };

  return {
    queries,
    async connect() {
      return fakeClient;
    },
  };
}

test('runTrackerFlushJob filters out orphan tag rows by joining ad_tags', async () => {
  const pool = createFakePool();

  const result = await runTrackerFlushJob(pool);

  assert.deepEqual(result, { impressionRows: 3, engagementRows: 4 });

  const eventUpsert = pool.queries.find((entry) => entry.sql.includes('INSERT INTO tag_daily_stats'));
  const engagementUpsert = pool.queries.find((entry) => entry.sql.includes('INSERT INTO tag_engagement_daily_stats'));

  assert.ok(eventUpsert?.sql.includes('JOIN ad_tags t ON t.id = s.tag_id'));
  assert.ok(engagementUpsert?.sql.includes('JOIN ad_tags t ON t.id = s.tag_id'));
});
