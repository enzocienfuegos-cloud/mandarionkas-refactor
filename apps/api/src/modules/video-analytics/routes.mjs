import { sendJson, unauthorized, forbidden, serviceUnavailable, badRequest } from '../../lib/http.mjs';
import { requireAuthenticatedSession } from '../auth/service.mjs';
import { recordVideoAnalyticsEvent, listRecentVideoAnalyticsEvents, getVideoAnalyticsSummary } from '@smx/db/video-analytics';
import { checkRateLimit } from '../../lib/rate-limit.mjs';

function hasPermission(session, permission) {
  return session.permissions.includes(permission);
}

function getActiveWorkspace(session) {
  return session.workspaces.find((workspace) => workspace.id === session.session.activeWorkspaceId) || session.workspaces[0] || null;
}

async function withSession(ctx, callback) {
  const session = await requireAuthenticatedSession({ env: ctx.env, headers: ctx.req.headers });
  if (!session.ok) {
    if (session.statusCode === 503) {
      return serviceUnavailable(ctx.res, ctx.requestId, session.message);
    }
    if (session.statusCode === 401) {
      return unauthorized(ctx.res, ctx.requestId, session.message);
    }
    return false;
  }

  try {
    return await callback(session);
  } finally {
    await session.finish();
  }
}

export async function handleVideoAnalyticsRoutes(ctx) {
  const { method, pathname, req, res, requestId, body, url } = ctx;

  if (method === 'POST' && pathname === '/v1/video-analytics/events') {
    const limit = checkRateLimit({ headers: req.headers, key: 'video-analytics-ingest', limit: 180, windowMs: 60_000 });
    if (!limit.ok) {
      return sendJson(res, 429, {
        ok: false,
        requestId,
        code: 'rate_limited',
        message: 'Too many analytics events. Please retry shortly.',
        retryAfterSeconds: limit.retryAfterSeconds,
      }, { 'Retry-After': String(limit.retryAfterSeconds) });
    }

    return withSession(ctx, async (session) => {
      if (!hasPermission(session, 'projects:view-client')) {
        return forbidden(res, requestId, 'You do not have permission to emit video analytics.');
      }
      const workspace = getActiveWorkspace(session);
      if (!workspace) return badRequest(res, requestId, 'An active workspace is required to emit analytics.');

      const eventName = String(body?.eventName ?? '').trim();
      if (!eventName) return badRequest(res, requestId, 'eventName is required.');

      await recordVideoAnalyticsEvent(session.client, {
        workspaceId: workspace.id,
        actorUserId: session.user.id,
        projectId: body?.projectId ? String(body.projectId) : null,
        sceneId: body?.sceneId ? String(body.sceneId) : null,
        widgetId: body?.widgetId ? String(body.widgetId) : null,
        sessionId: session.session.id,
        eventName,
        metadata: body?.metadata && typeof body.metadata === 'object' ? body.metadata : {},
      });

      return sendJson(res, 200, { ok: true, requestId });
    });
  }

  if (method === 'GET' && pathname === '/v1/video-analytics/events') {
    return withSession(ctx, async (session) => {
      if (!hasPermission(session, 'projects:view-client')) {
        return forbidden(res, requestId, 'You do not have permission to inspect video analytics.');
      }
      const workspace = getActiveWorkspace(session);
      if (!workspace) return sendJson(res, 200, { ok: true, requestId, events: [] });

      const limit = Number.parseInt(url.searchParams.get('limit') || '100', 10);
      const projectId = url.searchParams.get('projectId') || null;
      const widgetId = url.searchParams.get('widgetId') || null;
      const eventName = url.searchParams.get('eventName') || null;
      const events = await listRecentVideoAnalyticsEvents(session.client, {
        workspaceId: workspace.id,
        projectId,
        widgetId,
        eventName,
        limit,
      });
      return sendJson(res, 200, { ok: true, requestId, events });
    });
  }

  if (method === 'GET' && pathname === '/v1/video-analytics/summary') {
    return withSession(ctx, async (session) => {
      if (!hasPermission(session, 'projects:view-client')) {
        return forbidden(res, requestId, 'You do not have permission to inspect video analytics.');
      }
      const workspace = getActiveWorkspace(session);
      if (!workspace) {
        return sendJson(res, 200, {
          ok: true,
          requestId,
          summary: {
            totalEvents: 0,
            widgetCount: 0,
            sceneCount: 0,
            updatedAt: undefined,
            topEvents: [],
            topWidgets: [],
            hourlySeries: [],
            dailySeries: [],
          },
        });
      }

      const projectId = url.searchParams.get('projectId') || null;
      const widgetId = url.searchParams.get('widgetId') || null;
      const sceneId = url.searchParams.get('sceneId') || null;
      const eventName = url.searchParams.get('eventName') || null;
      const summary = await getVideoAnalyticsSummary(session.client, {
        workspaceId: workspace.id,
        projectId,
        widgetId,
        sceneId,
        eventName,
      });
      return sendJson(res, 200, { ok: true, requestId, summary });
    });
  }

  return false;
}
