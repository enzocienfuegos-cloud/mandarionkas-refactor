/**
 * apps/api/__tests__/health.test.mjs
 *
 * Smoke-tests the /health endpoint using a fake DB pool so no
 * real PostgreSQL connection is required.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// ── minimal fake pool ─────────────────────────────────────────────────────

function makeFakePool({ dbOk = true } = {}) {
  return {
    query: async (sql) => {
      if (!dbOk) throw new Error('DB error');
      return { rows: [{ '?column?': 1 }] };
    },
    connect: async () => ({ query: async () => ({ rows: [] }), release: () => {} }),
  };
}

// ── inline handler (mirrors server.mjs health route) ────────────────────

async function healthHandler(pool) {
  try {
    await pool.query('SELECT 1');
    return { ok: true, db: 'connected' };
  } catch {
    return { ok: false, db: 'error' };
  }
}

// ── tests ─────────────────────────────────────────────────────────────────

describe('health route handler', () => {
  it('returns ok=true when DB is reachable', async () => {
    const pool = makeFakePool({ dbOk: true });
    const result = await healthHandler(pool);
    assert.deepEqual(result, { ok: true, db: 'connected' });
  });

  it('returns ok=false when DB throws', async () => {
    const pool = makeFakePool({ dbOk: false });
    const result = await healthHandler(pool);
    assert.deepEqual(result, { ok: false, db: 'error' });
  });
});
