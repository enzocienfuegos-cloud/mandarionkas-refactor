// packages/db/src/frequency-cap.test.mjs
//
// S46: Tests for frequency cap logic.
// Run with: node --test packages/db/src/frequency-cap.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';
import { getWindowStartDate, checkFrequencyCap, recordFrequencyCapImpression, pruneFrequencyCapEvents } from './frequency-cap.mjs';

// ─── getWindowStartDate ────────────────────────────────────────────────────

test('getWindowStartDate: daily returns today', () => {
  const result = getWindowStartDate('daily');
  const today  = new Date().toISOString().slice(0, 10);
  assert.equal(result, today);
});

test('getWindowStartDate: weekly returns a Monday', () => {
  const result = getWindowStartDate('weekly');
  const date   = new Date(result + 'T00:00:00Z');
  // UTC day: 1 = Monday
  assert.equal(date.getUTCDay(), 1, `Expected Monday, got weekday ${date.getUTCDay()} for date ${result}`);
});

test('getWindowStartDate: weekly date is <= today', () => {
  const result = getWindowStartDate('weekly');
  const today  = new Date().toISOString().slice(0, 10);
  assert.ok(result <= today, `Weekly start ${result} should be <= today ${today}`);
});

test('getWindowStartDate: unknown window falls back to daily', () => {
  const result = getWindowStartDate('monthly');
  const today  = new Date().toISOString().slice(0, 10);
  assert.equal(result, today);
});

// ─── checkFrequencyCap ────────────────────────────────────────────────────

function makeFakePool(impressionCount) {
  return {
    async query(sql, params) {
      if (sql.includes('SUM(impressions)')) {
        return { rows: [{ count: impressionCount }] };
      }
      return { rows: [] };
    },
  };
}

test('checkFrequencyCap: no cap → never capped', async () => {
  const pool = makeFakePool(999);
  const result = await checkFrequencyCap(pool, { tagId: 't1', deviceId: 'd1', cap: null });
  assert.equal(result.capped, false);
});

test('checkFrequencyCap: no deviceId → never capped', async () => {
  const pool = makeFakePool(999);
  const result = await checkFrequencyCap(pool, { tagId: 't1', deviceId: '', cap: 5 });
  assert.equal(result.capped, false);
});

test('checkFrequencyCap: count < cap → not capped', async () => {
  const pool = makeFakePool(3);
  const result = await checkFrequencyCap(pool, { tagId: 't1', deviceId: 'd1', cap: 5 });
  assert.equal(result.capped, false);
  assert.equal(result.count, 3);
  assert.equal(result.cap, 5);
});

test('checkFrequencyCap: count === cap → capped', async () => {
  const pool = makeFakePool(5);
  const result = await checkFrequencyCap(pool, { tagId: 't1', deviceId: 'd1', cap: 5 });
  assert.equal(result.capped, true);
});

test('checkFrequencyCap: count > cap → capped', async () => {
  const pool = makeFakePool(10);
  const result = await checkFrequencyCap(pool, { tagId: 't1', deviceId: 'd1', cap: 5 });
  assert.equal(result.capped, true);
});

test('checkFrequencyCap: DB error → fails open (not capped)', async () => {
  const brokenPool = { async query() { throw new Error('DB down'); } };
  const result = await checkFrequencyCap(brokenPool, { tagId: 't1', deviceId: 'd1', cap: 5 });
  assert.equal(result.capped, false, 'Should fail open on DB error');
});

// ─── recordFrequencyCapImpression ─────────────────────────────────────────

test('recordFrequencyCapImpression: fires UPSERT with correct params', async () => {
  const calls = [];
  const pool = {
    async query(sql, params) {
      calls.push({ sql, params });
      return { rowCount: 1 };
    },
  };
  await recordFrequencyCapImpression(pool, { tagId: 't1', deviceId: 'd1', workspaceId: 'ws1' });
  assert.equal(calls.length, 1);
  const [tagId, deviceId, workspaceId] = calls[0].params;
  assert.equal(tagId, 't1');
  assert.equal(deviceId, 'd1');
  assert.equal(workspaceId, 'ws1');
  assert.ok(calls[0].sql.includes('ON CONFLICT'));
});

test('recordFrequencyCapImpression: skips when tagId missing', async () => {
  const calls = [];
  const pool = { async query() { calls.push(true); } };
  await recordFrequencyCapImpression(pool, { tagId: '', deviceId: 'd1', workspaceId: 'ws1' });
  assert.equal(calls.length, 0);
});

test('recordFrequencyCapImpression: never throws on DB error', async () => {
  const pool = { async query() { throw new Error('DB error'); } };
  // Must not throw
  await recordFrequencyCapImpression(pool, { tagId: 't1', deviceId: 'd1', workspaceId: 'ws1' });
  assert.ok(true, 'No error thrown');
});

// ─── pruneFrequencyCapEvents ──────────────────────────────────────────────

test('pruneFrequencyCapEvents: returns rowCount', async () => {
  const client = {
    async query(sql, params) {
      assert.ok(sql.includes('DELETE FROM tag_frequency_cap_events'));
      assert.ok(params[0] === 30);
      return { rowCount: 42 };
    },
  };
  const result = await pruneFrequencyCapEvents(client, 30);
  assert.equal(result, 42);
});

test('pruneFrequencyCapEvents: returns 0 on DB error', async () => {
  const client = { async query() { throw new Error('DB error'); } };
  const result = await pruneFrequencyCapEvents(client, 30);
  assert.equal(result, 0);
});
