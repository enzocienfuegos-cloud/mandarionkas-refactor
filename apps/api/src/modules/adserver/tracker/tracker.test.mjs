import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildClickBridgeHtml,
  createTrackerRoutes,
  extractTrackingContext,
  isFrameHostileClickDestination,
} from './routes.mjs';
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

function createCtx(method, pathname, searchParams = {}, env = {}) {
  const url = new URL(`http://localhost${pathname}`);
  for (const [key, value] of Object.entries(searchParams)) {
    url.searchParams.set(key, value);
  }
  return {
    method,
    pathname,
    url,
    req: { headers: { host: 'localhost' } },
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

test('click route serves a Dusk bridge for frame-hostile destinations', async () => {
  const handler = createTrackerRoutes(null);
  const destination = 'https://www.roblox.com/games/134720376226601/The-World-of-Bocadeli-Flavor';
  const ctx = createCtx('GET', '/v1/tags/tracker/tag-abc/click', { url: destination });

  const handled = await handler(ctx);

  assert.equal(handled, true);
  assert.equal(ctx.res.statusCode, 200);
  assert.equal(ctx.res.headers.Location, undefined);
  assert.equal(ctx.res.headers['Content-Type'], 'text/html; charset=utf-8');
  assert.match(String(ctx.res._body), /Opening destination/);
  assert.match(String(ctx.res._body), /window\.open/);
  assert.match(String(ctx.res._body), /www\.roblox\.com/);
});

test('click route supports explicit bridge mode for any destination', async () => {
  const handler = createTrackerRoutes(null);
  const ctx = createCtx('GET', '/v1/tags/tracker/tag-abc/click', {
    url: 'https://example.com/landing',
    smx_click_mode: 'bridge',
  });

  const handled = await handler(ctx);

  assert.equal(handled, true);
  assert.equal(ctx.res.statusCode, 200);
  assert.match(String(ctx.res._body), /https:\/\/example\.com\/landing/);
});

test('frame-hostile detection is scoped to Roblox destinations', () => {
  assert.equal(isFrameHostileClickDestination('https://www.roblox.com/games/123'), true);
  assert.equal(isFrameHostileClickDestination('https://create.roblox.com/store/asset/123'), true);
  assert.equal(isFrameHostileClickDestination('https://example.com/landing'), false);
});

test('click bridge escapes destination output', () => {
  const html = buildClickBridgeHtml('https://www.roblox.com/games/123?name=</script><img src=x>');
  assert.ok(!html.includes('</script><img'));
  assert.ok(html.includes('<\\/script>'));
  assert.ok(html.includes('&lt;/script&gt;&lt;img src=x&gt;'));
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
