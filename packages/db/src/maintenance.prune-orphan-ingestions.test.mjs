import test from 'node:test';
import assert from 'node:assert/strict';

import {
  deleteCreativeIngestionRows,
  pruneOrphanCreativeIngestions,
} from './maintenance.mjs';

test('pruneOrphanCreativeIngestions expires stale pending uploads and returns safe R2 sweep candidates', async () => {
  const queries = [];
  const client = {
    async query(sql, params = []) {
      const normalizedSql = String(sql).trim().replace(/\s+/g, ' ');
      queries.push({ sql: normalizedSql, params });
      if (/update creative_ingestions/i.test(sql)) return { rowCount: 1 };
      if (/from creative_ingestions ci/i.test(sql)) {
        return {
          rows: [
            {
              id: 'ingestion-failed-old',
              workspace_id: 'workspace-1',
              storage_key: 'workspaces/workspace-1/creative-ingestions/ingestion-failed-old/source.zip',
            },
          ],
        };
      }
      return { rows: [] };
    },
  };

  const result = await pruneOrphanCreativeIngestions(client, {
    pendingUploadTtlHours: 24,
    failedTtlHours: 168,
    limit: 50,
  });

  assert.equal(result.markedFailed, 1);
  assert.deepEqual(result.pendingR2Sweep, [
    {
      id: 'ingestion-failed-old',
      workspace_id: 'workspace-1',
      storage_key: 'workspaces/workspace-1/creative-ingestions/ingestion-failed-old/source.zip',
    },
  ]);

  assert.match(queries[0].sql, /status = 'pending_upload'/);
  assert.match(queries[0].sql, /error_code = 'upload_abandoned'/);
  assert.deepEqual(queries[0].params, ['24']);

  assert.match(queries[1].sql, /status = 'failed'/);
  assert.match(queries[1].sql, /storage_key is not null/);
  assert.match(queries[1].sql, /not exists \( select 1 from creative_artifacts/);
  assert.deepEqual(queries[1].params, ['168', 50]);
});

test('deleteCreativeIngestionRows deletes unique non-empty ids only', async () => {
  const queries = [];
  const client = {
    async query(sql, params = []) {
      queries.push({ sql: String(sql).trim().replace(/\s+/g, ' '), params });
      return { rowCount: params[0].length };
    },
  };

  const deleted = await deleteCreativeIngestionRows(client, ['a', '', 'a', null, 'b']);

  assert.equal(deleted, 2);
  assert.match(queries[0].sql, /delete from creative_ingestions/);
  assert.deepEqual(queries[0].params, [['a', 'b']]);
});
