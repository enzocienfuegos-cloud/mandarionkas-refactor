import { randomUUID } from 'node:crypto';

export function getRequestId(headers) {
  const existing = headers['cf-ray'] || headers['x-request-id'];
  return Array.isArray(existing) ? existing[0] : existing || randomUUID();
}

export function getOrigin(headers) {
  const origin = headers.origin;
  return Array.isArray(origin) ? origin[0] : origin || '';
}

function normalizeOrigin(value) {
  return String(value ?? '').trim().replace(/\/+$/, '');
}

export function applyCors(req, res, env) {
  const requestOrigin = normalizeOrigin(getOrigin(req.headers));
  const allowedOrigins = (Array.isArray(env.corsOrigins) && env.corsOrigins.length ? env.corsOrigins : [env.appOrigin])
    .map(normalizeOrigin)
    .filter(Boolean);
  const allowOrigin = requestOrigin && allowedOrigins.includes(requestOrigin)
    ? requestOrigin
    : allowedOrigins[0];
  if (allowOrigin) {
    res.setHeader('Access-Control-Allow-Origin', allowOrigin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Request-Id');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
}

export function sendJson(res, statusCode, payload, extraHeaders = {}) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  for (const [key, value] of Object.entries(extraHeaders)) {
    if (value !== undefined) res.setHeader(key, value);
  }
  res.end(JSON.stringify(payload));
  return true;
}

export function sendNoContent(res, extraHeaders = {}) {
  res.statusCode = 204;
  for (const [key, value] of Object.entries(extraHeaders)) {
    if (value !== undefined) res.setHeader(key, value);
  }
  res.end();
  return true;
}

export async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) return null;

  const body = Buffer.concat(chunks).toString('utf8').trim();
  if (!body) return null;

  try {
    return JSON.parse(body);
  } catch {
    return { __invalidJson: true, raw: body };
  }
}

export function notFound(res, requestId, pathname) {
  return sendJson(res, 404, {
    ok: false,
    code: 'not_found',
    requestId,
    message: `No route registered for ${pathname}`,
  });
}

export function notImplemented(res, requestId, pathname, details) {
  return sendJson(res, 501, {
    ok: false,
    code: 'not_implemented',
    requestId,
    message: `${pathname} is not implemented in the new backend yet.`,
    details,
  });
}

export function sendError(res, statusCode, { requestId, code, message, details }) {
  return sendJson(res, statusCode, {
    ok: false,
    requestId,
    code,
    message,
    ...(details ? { details } : {}),
  });
}

export function badRequest(res, requestId, message, details) {
  return sendError(res, 400, { requestId, code: 'bad_request', message, details });
}

export function unauthorized(res, requestId, message = 'Authentication is required.') {
  return sendError(res, 401, { requestId, code: 'unauthorized', message });
}

export function forbidden(res, requestId, message = 'You do not have permission to perform this action.') {
  return sendError(res, 403, { requestId, code: 'forbidden', message });
}

export function conflict(res, requestId, message, details) {
  return sendError(res, 409, { requestId, code: 'conflict', message, details });
}

export function serviceUnavailable(res, requestId, message, details) {
  return sendError(res, 503, { requestId, code: 'service_unavailable', message, details });
}
