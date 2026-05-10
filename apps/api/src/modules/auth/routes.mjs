import { sendJson, sendNoContent } from '../../lib/http.mjs';
import { buildClearedSessionCookie, createLoginSession, restoreSessionFromRequest, revokeSessionFromRequest } from './service.mjs';
import { checkRateLimit } from '../../lib/rate-limit.mjs';

export async function handleAuthRoutes({ method, pathname, res, requestId, env, req, body }) {
  if (method === 'GET' && pathname === '/v1/auth/session') {
    const result = await restoreSessionFromRequest({ env, headers: req.headers });
    const headers = result.clearCookie ? { 'Set-Cookie': buildClearedSessionCookie(env) } : undefined;
    return sendJson(res, result.statusCode, { ...result.payload, requestId }, headers);
  }

  if (method === 'POST' && pathname === '/v1/auth/login') {
    const limit = checkRateLimit({ headers: req.headers, key: 'auth-login', limit: 10, windowMs: 60_000 });
    if (!limit.ok) {
      return sendJson(res, 429, {
        ok: false,
        requestId,
        code: 'rate_limited',
        message: 'Too many login attempts. Please retry shortly.',
        retryAfterSeconds: limit.retryAfterSeconds,
      }, { 'Retry-After': String(limit.retryAfterSeconds) });
    }

    const result = await createLoginSession({
      env,
      email: body?.email,
      password: body?.password,
      remember: Boolean(body?.remember),
      headers: req.headers,
    });
    return sendJson(res, result.statusCode, { ...result.payload, requestId }, result.cookie ? { 'Set-Cookie': result.cookie } : undefined);
  }

  if (method === 'POST' && pathname === '/v1/auth/logout') {
    const result = await revokeSessionFromRequest({ env, headers: req.headers });
    return sendNoContent(res, { 'Set-Cookie': result.cookie });
  }

  if (method === 'GET' && pathname === '/v1/auth/health') {
    return sendJson(res, 200, { ok: true, requestId, module: 'auth', status: 'ready' });
  }

  return false;
}
