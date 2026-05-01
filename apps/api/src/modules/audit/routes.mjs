import { forbidden, sendJson, serviceUnavailable, unauthorized } from '../../lib/http.mjs';
import { withSession, hasPermission } from '../../lib/session.mjs';
import { queryAuditEvents } from '@smx/db/src/audit.mjs';


export async function handleAuditRoutes(ctx) {
  const { method, pathname, url, res, requestId } = ctx;

  if (method === 'GET' && pathname === '/v1/audit') {
    return withSession(ctx, async (session) => {
      if (!hasPermission(session, 'audit:read')) {
        return forbidden(res, requestId, 'You do not have permission to inspect audit events.');
      }

      const workspaceId = session.session.activeWorkspaceId || null;
      const payload = await queryAuditEvents(session.client, {
        workspaceId,
        limit: url.searchParams.get('limit'),
        offset: url.searchParams.get('offset'),
        action: url.searchParams.get('action'),
        actorEmail: url.searchParams.get('actorEmail'),
        resourceType: url.searchParams.get('resourceType'),
        dateFrom: url.searchParams.get('dateFrom'),
        dateTo: url.searchParams.get('dateTo'),
      });

      return sendJson(res, 200, { ...payload, requestId });
    });
  }

  return false;
}
