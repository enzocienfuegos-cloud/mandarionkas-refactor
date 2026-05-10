import test from 'node:test';
import assert from 'node:assert/strict';

import { updateSavedView } from './saved-views.mjs';

function fakeClient() {
  const calls = [];
  let nextRows = [];
  return {
    calls,
    setNextRows(rows) {
      nextRows = rows;
    },
    async query(sql, params) {
      calls.push({ sql: sql.trim().replace(/\s+/g, ' '), params });
      if (sql.trim().startsWith('update')) {
        return { rowCount: 1 };
      }
      return { rows: nextRows };
    },
  };
}

test('updateSavedView does not touch sort_json or columns_json when only name is patched', async () => {
  const client = fakeClient();
  client.setNextRows([{
    id: 'view-1',
    user_id: 'user-1',
    workspace_id: 'ws-1',
    surface: 'campaigns',
    name: 'Renamed',
    filters_json: { status: 'live' },
    sort_json: { col: 'budget', dir: 'desc' },
    columns_json: ['name', 'spend'],
    is_shared: false,
    created_at: new Date(),
    updated_at: new Date(),
  }]);

  await updateSavedView(client, {
    userId: 'user-1',
    workspaceId: 'ws-1',
    savedViewId: 'view-1',
    name: 'Renamed',
  });

  const updateCall = client.calls.find((call) => call.sql.startsWith('update'));
  assert.ok(updateCall);
  assert.match(updateCall.sql, /name = \$1/);
  assert.equal(updateCall.sql.includes('sort_json'), false);
  assert.equal(updateCall.sql.includes('columns_json'), false);
  assert.equal(updateCall.sql.includes('filters_json'), false);
  assert.equal(updateCall.sql.includes('is_shared'), false);
});

test('updateSavedView writes sort_json when sort is explicitly null in the patch', async () => {
  const client = fakeClient();
  client.setNextRows([{
    id: 'view-1',
    user_id: 'u',
    workspace_id: 'w',
    surface: 'campaigns',
    name: 'n',
    filters_json: {},
    sort_json: null,
    columns_json: [],
    is_shared: false,
    created_at: new Date(),
    updated_at: new Date(),
  }]);

  await updateSavedView(client, {
    userId: 'u',
    workspaceId: 'w',
    savedViewId: 'view-1',
    sort: null,
  });

  const updateCall = client.calls.find((call) => call.sql.startsWith('update'));
  assert.ok(updateCall);
  assert.equal(updateCall.sql.includes('sort_json'), true);
});
