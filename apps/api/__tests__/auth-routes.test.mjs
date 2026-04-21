/**
 * apps/api/__tests__/auth-routes.test.mjs
 *
 * Tests auth route handlers with a fake Fastify app + fake DB pool.
 * No real DB or HTTP server required.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildRequireWorkspace, handleAuthRoutes } from '../src/modules/auth/auth-routes.mjs';

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
  if (typeof rowMap === 'function') {
    return {
      calls,
      query: async (sql, params) => {
        calls.push({ sql, params });
        return rowMap(sql, params, calls);
      },
      connect: async () => ({
        query: async (sql, params) => {
          calls.push({ sql, params });
          return rowMap(sql, params, calls);
        },
        release: () => {},
      }),
    };
  }
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

describe('auth routes — POST /v1/auth/register', () => {
  it('allows invited users without passwords to complete registration', async () => {
    const pool = makeFakePool((sql, params) => {
      if (sql.includes('FROM users') && sql.includes('password_hash')) {
        return {
          rows: [{
            id: 'u-invite',
            email: 'invited@example.com',
            password_hash: null,
            display_name: null,
          }],
        };
      }
      if (sql.includes('UPDATE users') && sql.includes('password_hash = $2')) {
        return {
          rows: [{
            id: 'u-invite',
            email: 'invited@example.com',
            display_name: 'Invited User',
          }],
        };
      }
      if (sql.includes('UPDATE workspace_members wm') && sql.includes("status = 'active'")) {
        return { rows: [{ workspace_id: 'w-invite' }] };
      }
      if (sql.includes('UPDATE studio_invites si')) {
        return { rows: [] };
      }
      if (sql.includes('FROM workspaces w') && sql.includes("wm.status = 'active'")) {
        return {
          rows: [{
            id: 'w-invite',
            name: 'Invited Workspace',
            slug: 'invited-workspace',
            plan: 'free',
            logo_url: null,
            role: 'admin',
            joined_at: new Date().toISOString(),
          }],
        };
      }
      return { rows: [] };
    });
    const app = makeFakeApp();
    handleAuthRoutes(app, { pool });

    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      payload: {
        email: 'invited@example.com',
        password: 'Password123!',
        firstName: 'Invited',
        lastName: 'User',
      },
    });

    assert.equal(res.statusCode, 201);
    assert.match(res.body, /invited@example.com/);
    assert.match(res.body, /Invited Workspace/);
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

describe('buildRequireWorkspace', () => {
  it('rejects pending workspace members', async () => {
    const pool = makeFakePool((sql) => {
      if (sql.includes('FROM workspace_members wm')) {
        return {
          rows: [{
            role: 'admin',
            status: 'pending',
            email: 'pending@example.com',
          }],
        };
      }
      if (sql.includes('FROM users')) {
        return {
          rows: [{
            id: 'u1',
            email: 'pending@example.com',
          }],
        };
      }
      return { rows: [] };
    });
    const requireWorkspace = buildRequireWorkspace(pool);
    const req = {
      session: { userId: 'u1', workspaceId: 'w1' },
    };
    let statusCode = 200;
    let body = null;
    const reply = {
      status(n) { statusCode = n; return reply; },
      send(data) { body = data; return reply; },
    };

    await requireWorkspace(req, reply);

    assert.equal(statusCode, 403);
    assert.equal(body.message, 'Not a member of this workspace');
  });
});
