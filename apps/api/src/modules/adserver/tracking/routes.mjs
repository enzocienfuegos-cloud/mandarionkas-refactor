import { badRequest, forbidden, sendJson, serviceUnavailable, unauthorized } from '../../../lib/http.mjs';
import { requireAuthenticatedSession } from '../../auth/service.mjs';
import { withSession, hasPermission } from '../../../lib/session.mjs';
import { getTagById } from '@smx/db/src/tags.mjs';
import {
  getTagTrackingSummary,
  listTagTrackingDailyStats,
  listTagTrackingEvents,
} from '@smx/db/src/tracking.mjs';


async function resolveTagWorkspaceId(client, userId, tagId) {
  const tag = await getTagById(client, tagId);
  if (!tag) throw new Error('Tag not found.');
  const { rowCount } = await client.query(
    `select 1 from workspace_members where workspace_id = $1 and user_id = $2 limit 1`,
    [tag.workspace_id, userId],
  );
  if (!rowCount) throw new Error('You do not have access to this tag.');
  return tag.workspace_id;
}

function normalizeDays(value) {
  return Math.min(Math.max(Number(value) || 30, 1), 365);
}

export async function handleTrackingRoutes(ctx) {
  const { method, pathname, requestId, res, url } = ctx;

  if (method === 'GET' && /^\/v1\/tracking\/tags\/[^/]+\/summary$/.test(pathname)) {
    return withSession(ctx, async (session) => {
      if (!hasPermission(session, 'projects:view-client')) {
        return forbidden(res, requestId, 'You do not have permission to inspect tracking.');
      }
      const tagId = pathname.split('/')[4];
      try {
        const workspaceId = await resolveTagWorkspaceId(session.client, session.user.id, tagId);
        const days = normalizeDays(url.searchParams.get('days'));
        const summary = await getTagTrackingSummary(session.client, { workspaceId, tagId, days });
        return sendJson(res, 200, { ok: true, requestId, days, summary });
      } catch (error) {
        return badRequest(res, requestId, error.message);
      }
    });
  }

  if (method === 'GET' && /^\/v1\/tracking\/tags\/[^/]+\/daily$/.test(pathname)) {
    return withSession(ctx, async (session) => {
      if (!hasPermission(session, 'projects:view-client')) {
        return forbidden(res, requestId, 'You do not have permission to inspect tracking.');
      }
      const tagId = pathname.split('/')[4];
      try {
        const workspaceId = await resolveTagWorkspaceId(session.client, session.user.id, tagId);
        const days = normalizeDays(url.searchParams.get('days'));
        const stats = await listTagTrackingDailyStats(session.client, { workspaceId, tagId, days });
        return sendJson(res, 200, { ok: true, requestId, days, stats });
      } catch (error) {
        return badRequest(res, requestId, error.message);
      }
    });
  }

  if (method === 'GET' && /^\/v1\/tracking\/tags\/[^/]+\/events$/.test(pathname)) {
    return withSession(ctx, async (session) => {
      if (!hasPermission(session, 'projects:view-client')) {
        return forbidden(res, requestId, 'You do not have permission to inspect tracking.');
      }
      const tagId = pathname.split('/')[4];
      try {
        const workspaceId = await resolveTagWorkspaceId(session.client, session.user.id, tagId);
        const days = normalizeDays(url.searchParams.get('days'));
        const events = await listTagTrackingEvents(session.client, { workspaceId, tagId, days });
        return sendJson(res, 200, { ok: true, requestId, days, events });
      } catch (error) {
        return badRequest(res, requestId, error.message);
      }
    });
  }

  return false;
}
