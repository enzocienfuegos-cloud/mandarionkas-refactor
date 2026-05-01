import { sendJson, serviceUnavailable, unauthorized } from '../../../lib/http.mjs';
import { requireAuthenticatedSession } from '../../auth/service.mjs';
import { searchWorkspace } from '@smx/db/src/search.mjs';
import { withSession } from '../../../lib/session.mjs';

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
