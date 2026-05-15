import test from 'node:test';
import assert from 'node:assert/strict';

import { createTrackerRoutes, extractTrackingContext } from './routes.mjs';
import { TrackerBuffer } from './tracker-buffer.mjs';

function createFakePool() {
  const fakeClient = {
    released: false,
    queries: [],
    async query(sql, params) {
      this.queries.push({ sql: sql.trim().replace(/\s+/g, ' '), params });
      return { rows: [] };
    },
    release() {
      this.released = true;
    },
  };

  return {
    fakeClient,
    async connect() {
      return fakeClient;
    },
    async query() {
      return { rows: [] };
    },
  };
}

function createFakeRes() {
  const headers = {};
  return {
    statusCode: null,
    _body: null,
    headers,
    setHeader(key, value) {
      headers[key] = value;
    },
    removeHeader(key) {
      delete headers[key];
    },
    end(body) {
      this._body = body ?? null;
    },
  };
}

function createCtx(method, pathname, searchParams = {}, env = {}, headers = {}) {
  const url = new URL(`http://localhost${pathname}`);
  for (const [key, value] of Object.entries(searchParams)) {
    url.searchParams.set(key, value);
  }
  return {
    method,
    pathname,
    url,
    req: { headers: { host: 'localhost', ...headers } },
    res: createFakeRes(),
    requestId: 'test-req-id',
    env,
  };
}

test('TrackerBuffer accumulates and flushes on stop', async () => {
  const pool = createFakePool();
  const buffer = new TrackerBuffer(pool, { flushIntervalMs: 60_000, flushThreshold: 100_000 });

  buffer.addImpression('tag-1');
  buffer.addClick('tag-1');
  buffer.addEngagement('tag-1', 'complete', 30000);

  assert.equal(buffer.pendingCount, 3);
  await buffer.stop();
  assert.equal(buffer.pendingCount, 0);
  assert.ok(pool.fakeClient.queries.some((q) => q.sql.startsWith('BEGIN')));
  assert.ok(pool.fakeClient.queries.some((q) => q.sql.startsWith('COMMIT')));
});

test('TrackerBuffer triggers a threshold flush', async () => {
  const pool = createFakePool();
  const buffer = new TrackerBuffer(pool, { flushIntervalMs: 60_000, flushThreshold: 3 });
  buffer.addImpression('tag-1');
  buffer.addImpression('tag-2');
  buffer.addImpression('tag-3');
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.equal(buffer.pendingCount, 0);
  await buffer.stop();
});

test('TrackerBuffer persists events to staging shortly after receipt', async () => {
  const pool = createFakePool();
  const buffer = new TrackerBuffer(pool, {
    flushIntervalMs: 60_000,
    flushThreshold: 100_000,
    persistIntervalMs: 20,
  });

  buffer.addImpression('tag-durable');
  assert.equal(buffer.pendingCount, 1);

  await new Promise((resolve) => setTimeout(resolve, 50));

  assert.equal(buffer.pendingCount, 0);
  assert.ok(
    pool.fakeClient.queries.some((q) => q.sql.includes('INSERT INTO tracker_events_staging')),
    'buffer should write impressions to tracker_events_staging without waiting for stop()',
  );
  await buffer.stop();
});

test('impression route returns a GIF without requiring a database', async () => {
  const handler = createTrackerRoutes(null);
  const ctx = createCtx('GET', '/v1/tags/tracker/tag-abc/impression.gif');
  const handled = await handler(ctx);
  assert.equal(handled, true);
  assert.equal(ctx.res.statusCode, 200);
  assert.equal(ctx.res.headers['Content-Type'], 'image/gif');
  assert.ok(ctx.res._body instanceof Buffer);
});

test('engagement route returns 204 without requiring a database', async () => {
  const handler = createTrackerRoutes(null);
  const ctx = createCtx('GET', '/v1/tags/tracker/tag-abc/engagement', { event: 'midpoint' });
  const handled = await handler(ctx);
  assert.equal(handled, true);
  assert.equal(ctx.res.statusCode, 204);
});

test('click route redirects to explicit target without requiring a database', async () => {
  const handler = createTrackerRoutes(null);
  const ctx = createCtx('GET', '/v1/tags/tracker/tag-abc/click', { url: 'https://example.com/landing' });
  const handled = await handler(ctx);
  assert.equal(handled, true);
  assert.equal(ctx.res.statusCode, 302);
  assert.equal(ctx.res.headers.Location, 'https://example.com/landing');
});

test('click route redirects but does not count bot user agents', async () => {
  const pool = createFakePool();
  const buffer = new TrackerBuffer(pool, { flushIntervalMs: 60_000, flushThreshold: 100_000 });
  const handler = createTrackerRoutes(buffer);
  const ctx = createCtx(
    'GET',
    '/v1/tags/tracker/tag-bot/click',
    { url: 'https://example.com/landing' },
    {},
    { 'user-agent': 'Mozilla/5.0 Googlebot/2.1' },
  );

  const handled = await handler(ctx);

  assert.equal(handled, true);
  assert.equal(ctx.res.statusCode, 302);
  assert.equal(ctx.res.headers.Location, 'https://example.com/landing');
  assert.equal(buffer.pendingCount, 0);
  await buffer.stop();
});

test('click route does not count prefetch requests', async () => {
  const pool = createFakePool();
  const buffer = new TrackerBuffer(pool, { flushIntervalMs: 60_000, flushThreshold: 100_000 });
  const handler = createTrackerRoutes(buffer);
  const ctx = createCtx(
    'GET',
    '/v1/tags/tracker/tag-prefetch/click',
    { url: 'https://example.com/landing' },
    {},
    { 'sec-purpose': 'prefetch' },
  );

  const handled = await handler(ctx);

  assert.equal(handled, true);
  assert.equal(ctx.res.statusCode, 302);
  assert.equal(buffer.pendingCount, 0);
  await buffer.stop();
});

test('tracking context falls back to referer when DSP domain macros are unresolved', () => {
  const url = new URL('http://localhost/v1/tags/tracker/tag-abc/impression.gif?dom={domain}&purl={pageUrlEnc}');
  const ctx = extractTrackingContext(
    {
      headers: {
        referer: 'https://preview.example.com/tools/tag-preview?slot=hero',
        'user-agent': 'node-test',
      },
    },
    url,
    { country: null, region: null, city: null, ip: null },
  );

  assert.equal(ctx.siteDomain, 'preview.example.com');
  assert.equal(ctx.referer, 'https://preview.example.com/tools/tag-preview?slot=hero');
});

test('tracker routes use the buffer when provided', async () => {
  const pool = createFakePool();
  const buffer = new TrackerBuffer(pool, { flushIntervalMs: 60_000, flushThreshold: 100_000 });
  const handler = createTrackerRoutes(buffer);
  const ctx = createCtx('GET', '/v1/tags/tracker/tag-buf/impression.gif', {}, { databasePoolUrl: '' });
  await handler(ctx);
  assert.equal(buffer.pendingCount, 1);
  await buffer.stop();
});

test('TrackerBuffer re-queues events on staging write failure', async () => {
  let callCount = 0;
  const faultyPool = {
    async connect() {
      return {
        queries: [],
        async query() {
          callCount++;
          if (callCount === 1) throw new Error('simulated staging failure');
          return { rows: [] };
        },
        release() {},
      };
    },
  };

  const buffer = new TrackerBuffer(faultyPool, { flushIntervalMs: 60_000, flushThreshold: 100_000 });
  buffer.addImpression('tag-requeue');
  await buffer.stop();
  await buffer.stop();
  assert.equal(buffer.pendingCount, 0);
});
