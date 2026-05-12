import test from 'node:test';
import assert from 'node:assert/strict';

import { withTransaction } from './session.mjs';

function createStubClient({ rollbackError = null } = {}) {
  const queries = [];
  return {
    queries,
    async query(sql) {
      queries.push(sql);
      if (sql === 'ROLLBACK' && rollbackError) throw rollbackError;
      return { rows: [] };
    },
  };
}

test('withTransaction commits and returns callback result on success', async () => {
  const client = createStubClient();
  let callbackClient = null;

  const result = await withTransaction(client, async (tx) => {
    callbackClient = tx;
    await tx.query('SELECT 1');
    return { ok: true };
  });

  assert.equal(callbackClient, client);
  assert.deepEqual(result, { ok: true });
  assert.deepEqual(client.queries, ['BEGIN', 'SELECT 1', 'COMMIT']);
});

test('withTransaction rolls back and rethrows the original error on failure', async () => {
  const client = createStubClient();
  const originalError = new Error('publish failed');

  await assert.rejects(
    withTransaction(client, async (tx) => {
      await tx.query('INSERT creative');
      throw originalError;
    }),
    (error) => error === originalError,
  );

  assert.deepEqual(client.queries, ['BEGIN', 'INSERT creative', 'ROLLBACK']);
});

test('withTransaction preserves the original error when rollback also fails', async () => {
  const client = createStubClient({ rollbackError: new Error('rollback failed') });
  const originalError = new Error('artifact failed');

  await assert.rejects(
    withTransaction(client, async () => {
      throw originalError;
    }),
    (error) => error === originalError,
  );

  assert.deepEqual(client.queries, ['BEGIN', 'ROLLBACK']);
});
