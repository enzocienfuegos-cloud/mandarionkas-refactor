import test from 'node:test';
import assert from 'node:assert/strict';

import { reconcileStalledHtml5Publishes } from './creative-ingestion-reconciler.mjs';

test('reconcileStalledHtml5Publishes requeues within retry budget and fails exhausted rows', async () => {
  const queries = [];
  const client = {
    async query(sql, params = []) {
      queries.push({ sql: sql.trim().replace(/\s+/g, ' '), params });
      if (/FROM creative_ingestions/i.test(sql) && /status = 'processing'/i.test(sql)) {
        return {
          rows: [
            { id: 'ingestion-requeue', workspace_id: 'workspace-1', creative_version_id: 'version-1', retry_count: 0 },
            { id: 'ingestion-exhausted', workspace_id: 'workspace-1', creative_version_id: 'version-2', retry_count: 3 },
          ],
        };
      }
      return { rows: [] };
    },
  };

  const result = await reconcileStalledHtml5Publishes(client, { stallThresholdSeconds: 900, maxRetries: 3 });

  assert.deepEqual(result, { stalled: 2, requeued: 1, exhausted: 1 });
  assert.match(queries[0].sql, /updated_at < NOW\(\) -/);
  assert.match(queries[0].sql, /source_kind = 'html5_zip'/);
  assert.match(queries[0].sql, /creative_version_id IS NOT NULL/);

  const requeueUpdate = queries.find((query) => query.params[0] === 'ingestion-requeue' && /retryCount/.test(query.sql));
  assert.ok(requeueUpdate, 'expected retry metadata update for requeue row');
  assert.equal(requeueUpdate.params[1], 1);

  const notify = queries.find((query) => /pg_notify\('smx\.publish-html5-archive'/.test(query.sql));
  assert.deepEqual(notify?.params, ['ingestion-requeue']);

  const exhaustedUpdate = queries.find((query) => query.params[0] === 'ingestion-exhausted');
  assert.match(exhaustedUpdate?.sql ?? '', /status = 'failed'/);
  assert.match(exhaustedUpdate?.sql ?? '', /publish_stalled/);
});
