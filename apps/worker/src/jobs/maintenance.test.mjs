import test from 'node:test';
import assert from 'node:assert/strict';
import { runMaintenanceJobWithDeps } from './maintenance.mjs';

function createClient() {
  return {
    released: false,
    queries: [],
    async query(sql) {
      this.queries.push(sql);
      if (String(sql).includes('SELECT DISTINCT workspace_id')) return { rows: [] };
      return { rows: [] };
    },
    release() {
      this.released = true;
    },
  };
}

test('maintenance job skips cleanly when database is not configured', async () => {
  const result = await runMaintenanceJobWithDeps({}, {
    getPool() {
      throw new Error('getPool should not be called without a connection string');
    },
  });

  assert.equal(result.skipped, true);
});

test('maintenance job releases its client but does not close the shared pool', async () => {
  const client = createClient();
  let endCalls = 0;
  const calls = [];

  const result = await runMaintenanceJobWithDeps(
    { DATABASE_URL: 'postgres://example', DRAFT_RETENTION_DAYS: '30' },
    {
      getPool: () => ({
        connect: async () => client,
        end: async () => {
          endCalls += 1;
        },
      }),
      expirePendingUploadSessions: async () => {
        calls.push('expire');
        return 1;
      },
      revokeExpiredSessions: async () => {
        calls.push('revoke');
        return 2;
      },
      pruneOldDrafts: async () => {
        calls.push('drafts');
        return 3;
      },
      reconcileStalledVideoTranscodeJobs: async () => ({ stalled: 4, requeued: 5, exhausted: 6 }),
      reconcileStalledHtml5Publishes: async () => ({ stalled: 8, requeued: 9, exhausted: 10 }),
      pruneFrequencyCapEvents: async () => 7,
      runIdentityStitching: async () => {
        throw new Error('identity stitching should not run without active workspaces');
      },
    },
  );

  assert.equal(client.released, true);
  assert.equal(endCalls, 0);
  assert.deepEqual(calls, ['expire', 'revoke', 'drafts']);
  assert.equal(result.expiredUploadSessions, 1);
  assert.equal(result.revokedSessions, 2);
  assert.equal(result.prunedDrafts, 3);
  assert.equal(result.stalledTranscodes, 4);
  assert.equal(result.requeuedTranscodes, 5);
  assert.equal(result.exhaustedTranscodes, 6);
  assert.equal(result.stalledHtml5Publishes, 8);
  assert.equal(result.requeuedHtml5Publishes, 9);
  assert.equal(result.exhaustedHtml5Publishes, 10);
  assert.equal(result.prunedCapEvents, 7);
  assert.equal(result.stitchedEdges, 0);
  assert.equal(result.skipped, false);
});

test('maintenance job throttles identity stitching between runs', async () => {
  const client = createClient();
  let stitchCalls = 0;
  client.query = async (sql) => {
    client.queries.push(sql);
    if (String(sql).includes('SELECT DISTINCT workspace_id')) {
      return { rows: [{ workspace_id: 'workspace-1' }] };
    }
    return { rows: [] };
  };

  const deps = {
    getPool: () => ({
      connect: async () => client,
      end: async () => {},
    }),
    expirePendingUploadSessions: async () => 0,
    revokeExpiredSessions: async () => 0,
    pruneOldDrafts: async () => 0,
    reconcileStalledVideoTranscodeJobs: async () => ({ stalled: 0, requeued: 0, exhausted: 0 }),
    pruneFrequencyCapEvents: async () => 0,
    runIdentityStitching: async () => {
      stitchCalls += 1;
      return 10;
    },
  };

  const source = {
    DATABASE_URL: 'postgres://example',
    DRAFT_RETENTION_DAYS: '30',
    IDENTITY_STITCH_INTERVAL_MS: '60000',
  };

  const first = await runMaintenanceJobWithDeps(source, deps);
  const second = await runMaintenanceJobWithDeps(source, deps);

  assert.equal(first.stitchedEdges, 10);
  assert.equal(second.stitchedEdges, 0);
  assert.equal(stitchCalls, 1);
});
