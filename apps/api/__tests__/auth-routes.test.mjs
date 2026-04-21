/**
 * apps/api/__tests__/auth-routes.test.mjs
 *
 * Tests auth route handlers with a fake Fastify app + fake DB pool.
 * No real DB or HTTP server required.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { handleAuthRoutes } from '../src/modules/auth/auth-routes.mjs';

// ── fake Fastify app ──────────────────────────────────────────────────────

function makeFakeApp() {
  const routes = [];
  function reg(method) {
    return (path, optsOrHandler, maybeHandler) => {
      const isOpts = typeof optsOrHandler === 'object' && optsOrHandler !== null && !Array.isArray(optsOrHandler);
      const handler    = isOpts ? maybeHandler : optsOrHandler;
      const preHandler = isOpts ? (optsOrHandler.preHandler ?? null) : null;
      routes.push({ method: method.toUpperCase(), path, handler, preHandler });
    };
  }
  return {
    get: reg('GET'), post: reg('POST'), put: reg('PUT'),
    patch: reg('PATCH'), delete: reg('DELETE'),
    async inject({ method, url, payload }) {
      const route = routes.find(r => r.method === method.toUpperCase() && r.path === url);
      if (!route) return { statusCode: 404, body: JSON.stringify({ error: 'Not Found' }) };
      const req = {
        body: payload ?? {},
        session: { destroy() {} },
        headers: {},
        authSession: null,
      };
      let statusCode = 200;
      let responseBody = null;
      let replied = false;
      const reply = {
        code(n)   { statusCode = n; return reply; },
        status(n) { statusCode = n; return reply; },
        send(data) { responseBody = data; replied = true; return reply; },
        get sent() { return replied; },
      };
      // run preHandler if present
      if (route.preHandler) {
        await route.preHandler(req, reply);
        if (replied) return { statusCode, body: JSON.stringify(responseBody) };
      }
      await route.handler(req, reply);
      return { statusCode, body: JSON.stringify(responseBody) };
    },
  };
}

// ── fake DB pool ──────────────────────────────────────────────────────────

function makeFakePool(rowMap = {}) {
  const calls = [];
  return {
    calls,
    query: async (sql, params) => {
      calls.push({ sql, params });
      const key = Object.keys(rowMap).find(k => sql.includes(k));
      return { rows: key ? rowMap[key] : [] };
    },
    connect: async () => ({
      query: async (sql, params) => {
        calls.push({ sql, params });
        const key = Object.keys(rowMap).find(k => sql.includes(k));
        return { rows: key ? rowMap[key] : [] };
      },
      release: () => {},
    }),
  };
}

// ── tests ─────────────────────────────────────────────────────────────────

describe('auth routes — POST /v1/auth/login', () => {
  it('returns 400 when email missing', async () => {
    const app = makeFakeApp();
    handleAuthRoutes(app, { pool: makeFakePool() });
    const res = await app.inject({ method: 'POST', url: '/v1/auth/login', payload: { password: 'pw' } });
    assert.equal(res.statusCode, 400);
  });

  it('returns 400 when password missing', async () => {
    const app = makeFakeApp();
    handleAuthRoutes(app, { pool: makeFakePool() });
    const res = await app.inject({ method: 'POST', url: '/v1/auth/login', payload: { email: 'a@b.com' } });
    assert.equal(res.statusCode, 400);
  });

  it('returns 401 when user not found', async () => {
    const app = makeFakeApp();
    // pool returns no users
    handleAuthRoutes(app, { pool: makeFakePool({ 'FROM users': [] }) });
    const res = await app.inject({
      method: 'POST', url: '/v1/auth/login',
      payload: { email: 'nobody@example.com', password: 'pw' },
    });
    assert.equal(res.statusCode, 401);
  });
});

describe('auth routes — GET /v1/auth/me', () => {
  it('returns 401 when not logged in', async () => {
    const app = makeFakeApp();
    handleAuthRoutes(app, { pool: makeFakePool() });
    const res = await app.inject({ method: 'GET', url: '/v1/auth/me' });
    assert.equal(res.statusCode, 401);
  });
});

describe('auth routes — POST /v1/auth/logout', () => {
  it('returns 200 and clears session', async () => {
    const app = makeFakeApp();
    handleAuthRoutes(app, { pool: makeFakePool() });
    const res = await app.inject({ method: 'POST', url: '/v1/auth/logout' });
    assert.equal(res.statusCode, 200);
  });
});
