import { badRequest, sendJson, serviceUnavailable, unauthorized } from '../../../lib/http.mjs';
import { requireAuthenticatedSession } from '../../auth/service.mjs';
import {
  createApiKey,
  listApiKeys,
  revokeApiKey,
} from '../../../../../../packages/db/src/api-keys.mjs';

async function withSession(ctx, callback) {
  const session = await requireAuthenticatedSession({ env: ctx.env, headers: ctx.req.headers });
  if (!session.ok) {
    if (session.statusCode === 503) return serviceUnavailable(ctx.res, ctx.requestId, session.message);
    if (session.statusCode === 401) return unauthorized(ctx.res, ctx.requestId, session.message);
    return false;
  }

  try {
    return await callback(session);
  } finally {
    await session.finish();
  }
}

function getWorkspaceId(session) {
  return session.session.activeWorkspaceId || session.workspaces[0]?.id || null;
}

export async function handleApiKeyRoutes(ctx) {
  const { method, pathname, requestId, res, body } = ctx;

  if (method === 'GET' && pathname === '/v1/api-keys') {
    return withSession(ctx, async (session) => {
      const keys = await listApiKeys(session.client, getWorkspaceId(session));
      return sendJson(res, 200, { keys, requestId });
    });
  }

  if (method === 'POST' && pathname === '/v1/api-keys') {
    return withSession(ctx, async (session) => {
      if (!body || typeof body !== 'object') return badRequest(res, requestId, 'API key payload is required.');
      try {
        const result = await createApiKey(session.client, getWorkspaceId(session), session.user.id, body);
        return sendJson(res, 201, { ...result, requestId });
      } catch (error) {
        return badRequest(res, requestId, error?.message || 'Failed to create API key.');
      }
    });
  }

  if (method === 'DELETE' && /^\/v1\/api-keys\/[^/]+$/.test(pathname)) {
    return withSession(ctx, async (session) => {
      const apiKeyId = pathname.split('/')[3];
      try {
        await revokeApiKey(session.client, getWorkspaceId(session), apiKeyId);
        return sendJson(res, 200, { ok: true, requestId });
      } catch (error) {
        return badRequest(res, requestId, error?.message || 'Failed to revoke API key.');
      }
    });
  }

  return false;
}
