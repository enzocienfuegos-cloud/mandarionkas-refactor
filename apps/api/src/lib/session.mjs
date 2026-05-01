// apps/api/src/lib/session.mjs
//
// S50: Centralized session middleware and permission helpers.
//
// Before S50:
//   Every routes file duplicated the same 15-line withSession() and
//   3-line hasPermission() functions. 17 copies of withSession, 10 of hasPermission.
//   Any change to session error handling had to be applied to 17 files.
//
// After S50:
//   All routes import from here. Single source of truth.
//
// Usage:
//   import { withSession, hasPermission, requirePermission } from '../../../lib/session.mjs';
//
//   if (method === 'GET' && pathname === '/v1/campaigns') {
//     return withSession(ctx, async (session) => {
//       // session.user, session.permissions, session.client are available here
//       const campaigns = await listCampaigns(session.client, ...);
//       return sendJson(res, 200, { campaigns, requestId });
//     });
//   }
//
//   // Or with a permission guard:
//   if (method === 'POST' && pathname === '/v1/campaigns') {
//     return withSession(ctx, requirePermission('projects:save', async (session) => {
//       // Only reached if session has projects:save permission
//     }));
//   }

import { requireAuthenticatedSession } from '../modules/auth/service.mjs';
import { forbidden, serviceUnavailable, unauthorized } from './http.mjs';

// ─── withSession ───────────────────────────────────────────────────────────────

/**
 * Authenticate the request and run a callback with the resolved session.
 *
 * Returns false if the route does not match (caller can return false too).
 * Returns the response value from callback on success.
 * Returns a 401/503 JSON response if auth fails.
 *
 * @param {object} ctx            - Route context (env, req, res, requestId)
 * @param {Function} callback     - async (session) => response
 * @returns {Promise<unknown>}
 *
 * @example
 * return withSession(ctx, async (session) => {
 *   const data = await getData(session.client, session.session.activeWorkspaceId);
 *   return sendJson(res, 200, { data, requestId });
 * });
 */
export async function withSession(ctx, callback) {
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

// ─── hasPermission ─────────────────────────────────────────────────────────────

/**
 * Check if the authenticated session has a specific permission.
 *
 * @param {object} session      - Session object from withSession callback
 * @param {string} permission   - Permission string (e.g. 'projects:save')
 * @returns {boolean}
 *
 * @example
 * if (!hasPermission(session, 'projects:save')) {
 *   return forbidden(res, requestId, 'You do not have permission to create campaigns.');
 * }
 */
export function hasPermission(session, permission) {
  return Array.isArray(session.permissions) && session.permissions.includes(permission);
}

// ─── requirePermission ────────────────────────────────────────────────────────

/**
 * Higher-order function: wraps a session callback with a permission guard.
 * Returns a 403 if the session lacks the required permission.
 *
 * Designed to be composed with withSession:
 *   return withSession(ctx, requirePermission('projects:save', async (session) => { ... }));
 *
 * @param {string} permission   - Required permission
 * @param {Function} callback   - async (session) => response
 * @returns {Function}          - Wrapped callback for use with withSession
 *
 * @example
 * return withSession(ctx, requirePermission('audit:read', async (session) => {
 *   const events = await queryAuditEvents(session.client, ...);
 *   return sendJson(res, 200, { events, requestId });
 * }));
 */
export function requirePermission(permission, callback) {
  return async function permissionGuard(session) {
    if (!hasPermission(session, permission)) {
      return forbidden(session._ctx?.res ?? session.res, session._requestId ?? '', `Permission required: ${permission}`);
    }
    return callback(session);
  };
}

/**
 * Variant of requirePermission that has access to ctx for the forbidden response.
 * Use this when you need to compose permission checks inside withSession.
 *
 * @param {object} ctx          - Route context (needed for res + requestId)
 * @param {string} permission   - Required permission
 * @param {Function} callback   - async (session) => response
 * @returns {Function}          - Wrapped callback for use with withSession
 *
 * @example
 * return withSession(ctx, guardPermission(ctx, 'projects:save', async (session) => {
 *   // Only runs if permission is present
 * }));
 */
export function guardPermission(ctx, permission, callback) {
  return async function permissionGuard(session) {
    if (!hasPermission(session, permission)) {
      return forbidden(ctx.res, ctx.requestId, `Permission required: ${permission}`);
    }
    return callback(session);
  };
}
