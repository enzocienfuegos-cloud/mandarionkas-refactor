import { sendJson, serviceUnavailable, unauthorized } from '../../../lib/http.mjs';
import { requireAuthenticatedSession } from '../../auth/service.mjs';
import { searchWorkspace } from '../../../../../../packages/db/src/search.mjs';

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

export async function handleSearchRoutes(ctx) {
  const { method, pathname, requestId, res, url } = ctx;

  if (method === 'GET' && pathname === '/v1/search') {
    return withSession(ctx, async (session) => {
      const payload = await searchWorkspace(
        session.client,
        getWorkspaceId(session),
        url.searchParams.get('q'),
        {
          type: url.searchParams.get('type'),
          limit: url.searchParams.get('limit'),
        },
      );
      return sendJson(res, 200, { ...payload, requestId });
    });
  }

  return false;
}
