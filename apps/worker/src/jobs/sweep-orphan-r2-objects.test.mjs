import test from 'node:test';
import assert from 'node:assert/strict';

import { runSweepOrphanR2ObjectsJobWithDeps } from './sweep-orphan-r2-objects.mjs';

function baseEnv(overrides = {}) {
  return {
    DATABASE_URL: 'postgres://fake/db',
    R2_ENDPOINT: 'https://fake.r2.cloudflarestorage.com',
    R2_BUCKET: 'smx-test',
    R2_ACCESS_KEY_ID: 'key',
    R2_SECRET_ACCESS_KEY: 'secret',
    ...overrides,
  };
}

class FakeDeleteObjectCommand {
  constructor(input) {
    this.input = input;
  }
}

function createDeps({ pruneResult, sendImpl = async () => ({}) } = {}) {
  const calls = {
    deletedObjects: [],
    deletedRows: [],
  };
  const fakeClient = {
    released: false,
    release() {
      this.released = true;
    },
  };

  const deps = {
    DeleteObjectCommand: FakeDeleteObjectCommand,
    getPool: () => ({
      connect: async () => fakeClient,
    }),
    getR2Client: () => ({
      async send(command) {
        calls.deletedObjects.push(command.input);
        return sendImpl(command);
      },
    }),
    pruneOrphanCreativeIngestions: async () => pruneResult ?? {
      markedFailed: 1,
      pendingR2Sweep: [
        {
          id: 'ingestion-1',
          workspace_id: 'workspace-1',
          storage_key: 'workspaces/workspace-1/creative-ingestions/ingestion-1/source.zip',
        },
      ],
    },
    deleteCreativeIngestionRows: async (_client, ids) => {
      calls.deletedRows.push(ids);
      return ids.length;
    },
  };

  return { calls, fakeClient, deps };
}

test('sweep job deletes R2 object and then deletes the ingestion row', async () => {
  const { calls, fakeClient, deps } = createDeps();

  const result = await runSweepOrphanR2ObjectsJobWithDeps(baseEnv(), deps);

  assert.deepEqual(calls.deletedObjects, [
    {
      Bucket: 'smx-test',
      Key: 'workspaces/workspace-1/creative-ingestions/ingestion-1/source.zip',
    },
  ]);
  assert.deepEqual(calls.deletedRows, [['ingestion-1']]);
  assert.equal(result.markedFailed, 1);
  assert.equal(result.pendingSweep, 1);
  assert.equal(result.sweptObjects, 1);
  assert.equal(result.deletedRows, 1);
  assert.equal(result.failedDeletes, 0);
  assert.equal(fakeClient.released, true);
});

test('sweep job treats missing R2 objects as safe to delete from DB', async () => {
  const { calls, deps } = createDeps({
    sendImpl: async () => {
      const error = new Error('Not found');
      error.name = 'NoSuchKey';
      throw error;
    },
  });

  const result = await runSweepOrphanR2ObjectsJobWithDeps(baseEnv(), deps);

  assert.deepEqual(calls.deletedRows, [['ingestion-1']]);
  assert.equal(result.sweptObjects, 0);
  assert.equal(result.missingObjects, 1);
  assert.equal(result.failedDeletes, 0);
  assert.equal(result.deletedRows, 1);
});

test('sweep job keeps DB rows when R2 is not configured', async () => {
  const { calls, deps } = createDeps();

  const result = await runSweepOrphanR2ObjectsJobWithDeps(baseEnv({ R2_ENDPOINT: '' }), deps);

  assert.deepEqual(calls.deletedObjects, []);
  assert.deepEqual(calls.deletedRows, []);
  assert.equal(result.r2Skipped, true);
  assert.equal(result.reason, 'r2_not_configured');
  assert.equal(result.pendingSweep, 1);
});
