import { badRequest, notFound, sendJson, serviceUnavailable } from '../../lib/http.mjs';
import { withSession } from '../../lib/session.mjs';
import { createSavedView, deleteSavedView, getSavedView, listSavedViews, updateSavedView } from '@smx/db/src/saved-views.mjs';

function getActiveWorkspaceId(session) {
  return session.session.activeWorkspaceId || session.workspaces[0]?.id || null;
}

export async function handleSavedViewRoutes(ctx) {
  const { method, pathname, url, body, res, requestId } = ctx;

  if (method === 'GET' && pathname === '/v1/saved-views') {
    return withSession(ctx, async (session) => {
      const workspaceId = getActiveWorkspaceId(session);
      if (!workspaceId) return badRequest(res, requestId, 'No active workspace available.');
      const surface = String(url.searchParams.get('surface') || '').trim();
      const views = await listSavedViews(session.client, {
        userId: session.user.id,
        workspaceId,
        surface: surface || undefined,
      });
      return sendJson(res, 200, { ok: true, requestId, views });
    });
  }

  if (method === 'GET' && /^\/v1\/saved-views\/[^/]+$/.test(pathname)) {
    return withSession(ctx, async (session) => {
      const workspaceId = getActiveWorkspaceId(session);
      if (!workspaceId) return badRequest(res, requestId, 'No active workspace available.');
      const savedViewId = pathname.split('/')[3];
      const view = await getSavedView(session.client, {
        userId: session.user.id,
        workspaceId,
        savedViewId,
      });
      if (!view) return notFound(res, requestId, 'Saved view not found.');
      return sendJson(res, 200, { ok: true, requestId, view });
    });
  }

  if (method === 'POST' && pathname === '/v1/saved-views') {
    return withSession(ctx, async (session) => {
      const workspaceId = getActiveWorkspaceId(session);
      if (!workspaceId) return badRequest(res, requestId, 'No active workspace available.');
      try {
        const view = await createSavedView(session.client, {
          userId: session.user.id,
          workspaceId,
          surface: body?.surface,
          name: body?.name,
          filters: body?.filters,
          sort: body?.sort ?? null,
          columns: body?.columns ?? [],
          isShared: body?.isShared ?? body?.is_shared ?? false,
        });
        return sendJson(res, 201, { ok: true, requestId, view });
      } catch (error) {
        if (error?.statusCode === 503) {
          return serviceUnavailable(res, requestId, error.message);
        }
        return badRequest(res, requestId, error.message);
      }
    });
  }

  if (method === 'PUT' && /^\/v1\/saved-views\/[^/]+$/.test(pathname)) {
    return withSession(ctx, async (session) => {
      const workspaceId = getActiveWorkspaceId(session);
      if (!workspaceId) return badRequest(res, requestId, 'No active workspace available.');
      const savedViewId = pathname.split('/')[3];
      try {
        const view = await updateSavedView(session.client, {
          userId: session.user.id,
          workspaceId,
          savedViewId,
          name: body?.name,
          filters: body?.filters,
          sort: body?.sort,
          columns: body?.columns,
          isShared: body?.isShared ?? body?.is_shared,
        });
        if (!view) return notFound(res, requestId, 'Saved view not found.');
        return sendJson(res, 200, { ok: true, requestId, view });
      } catch (error) {
        if (error?.statusCode === 503) {
          return serviceUnavailable(res, requestId, error.message);
        }
        return badRequest(res, requestId, error.message);
      }
    });
  }

  if (method === 'DELETE' && /^\/v1\/saved-views\/[^/]+$/.test(pathname)) {
    return withSession(ctx, async (session) => {
      const workspaceId = getActiveWorkspaceId(session);
      if (!workspaceId) return badRequest(res, requestId, 'No active workspace available.');
      const savedViewId = pathname.split('/')[3];
      try {
        await deleteSavedView(session.client, {
          userId: session.user.id,
          workspaceId,
          savedViewId,
        });
        return sendJson(res, 200, { ok: true, requestId });
      } catch (error) {
        if (error?.statusCode === 503) {
          return serviceUnavailable(res, requestId, error.message);
        }
        if (error.message === 'Saved view not found.') {
          return notFound(res, requestId, error.message);
        }
        return badRequest(res, requestId, error.message);
      }
    });
  }

  return false;
}
