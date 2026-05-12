import test from 'node:test';
import assert from 'node:assert/strict';

import { checkPostgresRateLimit } from './rate-limit.mjs';

function withFrozenNow(nowMs, callback) {
  const originalNow = Date.now;
  Date.now = () => nowMs;
  return Promise.resolve()
    .then(callback)
    .finally(() => {
      Date.now = originalNow;
    });
}

function createClient(selectRows = []) {
  const queries = [];
  const client = {
    async query(sql, params = []) {
      const normalizedSql = String(sql).trim().replace(/\s+/g, ' ');
      queries.push({ sql: normalizedSql, params });
      if (/SELECT count, reset_at FROM rate_limit_buckets/i.test(normalizedSql)) {
        return { rows: selectRows };
      }
      return { rows: [], rowCount: 1 };
    },
  };
  return { client, queries };
}

test('checkPostgresRateLimit creates a new fixed-window bucket', async () => {
  const { client, queries } = createClient([]);

  const result = await withFrozenNow(1_000, () => checkPostgresRateLimit(client, {
    headers: { 'x-forwarded-for': '203.0.113.10, 10.0.0.1' },
    key: 'creative-upload:user:workspace',
    limit: 5,
    windowMs: 60_000,
  }));

  assert.equal(result.ok, true);
  assert.equal(result.remaining, 4);
  assert.equal(result.resetAt, 61_000);
  assert.deepEqual(queries.map((query) => query.sql), [
    'BEGIN',
    'SELECT pg_advisory_xact_lock(hashtext($1)::bigint)',
    'SELECT count, reset_at FROM rate_limit_buckets WHERE bucket_key = $1 FOR UPDATE',
    'INSERT INTO rate_limit_buckets (bucket_key, count, reset_at) VALUES ($1, 1, $2) ON CONFLICT (bucket_key) DO UPDATE SET count = 1, reset_at = EXCLUDED.reset_at, updated_at = NOW()',
    'COMMIT',
  ]);
  assert.equal(queries[1].params[0], 'creative-upload:user:workspace:203.0.113.10');
});

test('checkPostgresRateLimit increments an active bucket', async () => {
  const { client, queries } = createClient([{ count: 2, reset_at: new Date(61_000) }]);

  const result = await withFrozenNow(1_000, () => checkPostgresRateLimit(client, {
    headers: { 'x-real-ip': '203.0.113.20' },
    key: 'creative-upload:user:workspace',
    limit: 5,
    windowMs: 60_000,
  }));

  assert.equal(result.ok, true);
  assert.equal(result.remaining, 2);
  const update = queries.find((query) => /UPDATE rate_limit_buckets/.test(query.sql));
  assert.deepEqual(update?.params, ['creative-upload:user:workspace:203.0.113.20', 3]);
  assert.equal(queries.at(-1).sql, 'COMMIT');
});

test('checkPostgresRateLimit returns retry metadata when the bucket is full', async () => {
  const { client, queries } = createClient([{ count: 5, reset_at: new Date(31_000) }]);

  const result = await withFrozenNow(1_000, () => checkPostgresRateLimit(client, {
    headers: { 'x-real-ip': '203.0.113.30' },
    key: 'creative-upload:user:workspace',
    limit: 5,
    windowMs: 60_000,
  }));

  assert.equal(result.ok, false);
  assert.equal(result.remaining, 0);
  assert.equal(result.retryAfterSeconds, 30);
  assert.equal(queries.some((query) => /UPDATE rate_limit_buckets/.test(query.sql)), false);
  assert.equal(queries.at(-1).sql, 'COMMIT');
});

test('checkPostgresRateLimit rolls back on query errors', async () => {
  const queries = [];
  const client = {
    async query(sql, params = []) {
      const normalizedSql = String(sql).trim().replace(/\s+/g, ' ');
      queries.push({ sql: normalizedSql, params });
      if (/SELECT count, reset_at FROM rate_limit_buckets/i.test(normalizedSql)) {
        throw new Error('database unavailable');
      }
      return { rows: [] };
    },
  };

  await assert.rejects(
    () => withFrozenNow(1_000, () => checkPostgresRateLimit(client, {
      headers: {},
      key: 'creative-upload',
      limit: 5,
      windowMs: 60_000,
    })),
    /database unavailable/,
  );
  assert.equal(queries.at(-1).sql, 'ROLLBACK');
});
