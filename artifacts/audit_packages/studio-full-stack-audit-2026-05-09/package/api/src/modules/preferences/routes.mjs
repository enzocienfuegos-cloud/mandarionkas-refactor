import { badRequest, sendJson } from '../../lib/http.mjs';
import { withReadOnlySession, withSession } from '../../lib/session.mjs';
import { getUserPreferences, saveUserPreferences } from '@smx/db/src/preferences.mjs';

export async function handlePreferenceRoutes(ctx) {
  const { method, pathname, body, res, requestId } = ctx;

  if (method === 'GET' && pathname === '/v1/preferences') {
    return withReadOnlySession(ctx, async (session) => {
      const preferences = await getUserPreferences(session.client, session.user.id);
      return sendJson(res, 200, { ok: true, requestId, preferences });
    });
  }

  if ((method === 'PUT' || method === 'PATCH') && pathname === '/v1/preferences') {
    return withSession(ctx, async (session) => {
      const patch = body?.preferences ?? body ?? {};
      try {
        const preferences = await saveUserPreferences(session.client, session.user.id, patch);
        return sendJson(res, 200, { ok: true, requestId, preferences });
      } catch (error) {
        return badRequest(res, requestId, error.message);
      }
    });
  }

  return false;
}
