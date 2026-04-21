import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { handleStudioClientRoutes } from '../src/modules/studio/client-routes.mjs';
import { handleStudioProjectRoutes } from '../src/modules/studio/project-routes.mjs';
import { handleStudioAssetRoutes } from '../src/modules/studio/asset-routes.mjs';

function compilePath(path) {
  const keys = [];
  const pattern = path.replace(/:([A-Za-z0-9_]+)/g, (_, key) => {
    keys.push(key);
    return '([^/]+)';
  });
  return {
    regex: new RegExp(`^${pattern}$`),
    keys,
  };
}

function makeFakeApp() {
  const routes = [];
  function reg(method) {
    return (path, optsOrHandler, maybeHandler) => {
      const isOpts = typeof optsOrHandler === 'object' && optsOrHandler !== null && !Array.isArray(optsOrHandler);
      const handler = isOpts ? maybeHandler : optsOrHandler;
      const preHandler = isOpts ? (optsOrHandler.preHandler ?? null) : null;
      const compiled = compilePath(path);
      routes.push({ method: method.toUpperCase(), path, handler, preHandler, ...compiled });
    };
  }
  return {
    get: reg('GET'),
    post: reg('POST'),
    put: reg('PUT'),
    patch: reg('PATCH'),
    delete: reg('DELETE'),
    async inject({ method, url, payload, authSession }) {
      const route = routes.find((candidate) => candidate.method === method.toUpperCase() && candidate.regex.test(url));
      if (!route) return { statusCode: 404, body: JSON.stringify({ error: 'Not Found' }) };
      const match = route.regex.exec(url);
      const params = Object.fromEntries(route.keys.map((key, index) => [key, match[index + 1]]));
      const req = {
        body: payload ?? {},
        params,
        session: {},
        headers: {},
        authSession: authSession ?? null,
      };
      let statusCode = 200;
      let responseBody = null;
      let replied = false;
      const reply = {
        code(n) { statusCode = n; return reply; },
        status(n) { statusCode = n; return reply; },
        send(data) { responseBody = data; replied = true; return reply; },
        get sent() { return replied; },
      };
      if (route.preHandler) {
        await route.preHandler(req, reply);
        if (replied) return { statusCode, body: JSON.stringify(responseBody) };
      }
      await route.handler(req, reply);
      return { statusCode, body: responseBody == null ? '' : JSON.stringify(responseBody) };
    },
  };
}

function makeRequireWorkspace(authSession) {
  return async (req) => {
    req.authSession = { ...authSession };
    req.session = { workspaceId: authSession.workspaceId, userId: authSession.userId };
  };
}

describe('studio client routes', () => {
  it('blocks switching active client when user is not a member of the target client', async () => {
    const app = makeFakeApp();
    handleStudioClientRoutes(
      app,
      {
        pool: {},
        requireWorkspace: makeRequireWorkspace({ userId: 'u1', workspaceId: 'w1', role: 'owner' }),
      },
      {
        resolveStudioClientAccess: async () => null,
        resolveStudioCurrentUser: async () => ({ id: 'u1', email: 'owner@example.com' }),
        buildStudioSessionPayload: async () => ({ activeClientId: 'w1', activeWorkspaceId: 'w1', clients: [], workspaces: [] }),
        handleCreateStudioBrand: async () => {},
        handleCreateStudioClient: async () => 'w2',
        handleInviteStudioMember: async () => {},
      },
    );

    const res = await app.inject({
      method: 'POST',
      url: '/v1/clients/active',
      payload: { clientId: 'w2' },
    });

    assert.equal(res.statusCode, 403);
  });

  it('blocks brand creation when target client role is reviewer', async () => {
    const app = makeFakeApp();
    handleStudioClientRoutes(
      app,
      {
        pool: {},
        requireWorkspace: makeRequireWorkspace({ userId: 'u1', workspaceId: 'w1', role: 'owner' }),
      },
      {
        resolveStudioClientAccess: async () => ({ role: 'reviewer' }),
        resolveStudioCurrentUser: async () => ({ id: 'u1', email: 'owner@example.com' }),
        buildStudioSessionPayload: async () => ({ clients: [], workspaces: [] }),
        handleCreateStudioBrand: async () => {},
        handleCreateStudioClient: async () => 'w2',
        handleInviteStudioMember: async () => {},
      },
    );

    const res = await app.inject({
      method: 'POST',
      url: '/v1/clients/w2/brands',
      payload: { name: 'Brand A', primaryColor: '#000000' },
    });

    assert.equal(res.statusCode, 403);
  });
});

describe('studio project routes', () => {
  it('blocks project deletion for editors', async () => {
    const app = makeFakeApp();
    handleStudioProjectRoutes(app, {
      pool: {},
      requireWorkspace: makeRequireWorkspace({ userId: 'u1', workspaceId: 'w1', role: 'admin' }),
    });

    const res = await app.inject({
      method: 'DELETE',
      url: '/v1/projects/p1',
    });

    assert.equal(res.statusCode, 403);
  });

  it('allows reviewers to list projects', async () => {
    const app = makeFakeApp();
    handleStudioProjectRoutes(
      app,
      {
        pool: {},
        requireWorkspace: makeRequireWorkspace({ userId: 'u1', workspaceId: 'w1', role: 'viewer' }),
      },
      {
        listStudioProjects: async () => [{ id: 'p1', state: {}, name: 'Demo' }],
        mapStudioProjectRowToDto: (row) => row,
        changeStudioProjectOwner: async () => {},
        deleteStudioProject: async () => {},
        duplicateStudioProject: async () => null,
        getStudioProject: async () => null,
        listStudioProjectVersions: async () => [],
        loadStudioProjectVersion: async () => null,
        saveStudioProject: async () => ({}),
        saveStudioProjectVersion: async () => null,
        updateStudioProjectArchiveState: async () => {},
      },
    );

    const res = await app.inject({
      method: 'GET',
      url: '/v1/projects',
    });

    assert.equal(res.statusCode, 200);
    assert.match(res.body, /"p1"/);
  });
});

describe('studio asset routes', () => {
  it('blocks asset creation for reviewers', async () => {
    const app = makeFakeApp();
    handleStudioAssetRoutes(app, {
      pool: {},
      requireWorkspace: makeRequireWorkspace({ userId: 'u1', workspaceId: 'w1', role: 'viewer' }),
    });

    const res = await app.inject({
      method: 'POST',
      url: '/v1/assets',
      payload: { asset: { name: 'Banner' } },
    });

    assert.equal(res.statusCode, 403);
  });

  it('allows reviewers to list assets', async () => {
    const app = makeFakeApp();
    handleStudioAssetRoutes(
      app,
      {
        pool: {},
        requireWorkspace: makeRequireWorkspace({ userId: 'u1', workspaceId: 'w1', role: 'viewer' }),
      },
      {
        listStudioAssets: async () => [{ id: 'a1', name: 'Banner' }],
        mapStudioAssetRowToDto: (row) => row,
        createStudioAssetFolder: async () => ({}),
        deleteStudioAsset: async () => {},
        deleteStudioAssetFolder: async () => {},
        getStudioAsset: async () => null,
        listStudioAssetFolders: async () => [],
        mapStudioAssetFolderRowToDto: (row) => row,
        patchStudioAsset: async () => null,
        renameStudioAssetFolder: async () => null,
        saveStudioAsset: async () => ({}),
      },
    );

    const res = await app.inject({
      method: 'GET',
      url: '/v1/assets',
    });

    assert.equal(res.statusCode, 200);
    assert.match(res.body, /"a1"/);
  });
});
