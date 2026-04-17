import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { checkRepositoryReadiness, getRepositoryMetadata } from './data/repository.mjs';
import { createRequestContext, getObservabilitySnapshot, logServerEvent, recordRequestMetric } from './observability.mjs';
import { consumeRateLimit, getRateLimitHeaders, getRequestRateLimitSubject } from './rate-limit.mjs';
import {
  authenticate,
  cleanupExpiredSessions,
  getSessionContext,
  listClientsForSession,
  revokeSession,
} from './services/auth-service.mjs';
import {
  archiveProjectForSession,
  changeProjectOwnerForSession,
  deleteProjectForSession,
  duplicateProjectForSession,
  listProjectVersionsForSession,
  listProjectsForSession,
  loadProjectForSession,
  loadProjectVersionForSession,
  restoreProjectForSession,
  saveProjectForSession,
  saveProjectVersionForSession,
} from './services/project-service.mjs';
import {
  createAssetFolderForSession,
  deleteAssetForSession,
  getAssetForSession,
  listAssetFoldersForSession,
  listAssetsForSession,
  renameAssetForSession,
  saveAssetForSession,
} from './services/asset-service.mjs';
import {
  cleanupStaleDocumentSlots,
  clearDocumentForSession,
  hasDocumentForSession,
  loadDocumentForSession,
  saveDocumentForSession,
} from './services/document-service.mjs';
import {
  addBrandToClientForSession,
  createClientForSession,
  inviteMemberToClientForSession,
  setActiveClientForSession,
} from './services/client-service.mjs';
import {
  cleanupAssetHousekeepingForSession,
  getAssetHousekeepingForSession,
} from './services/asset-admin-service.mjs';
import { listAuditEventsForSession } from './services/audit-service.mjs';
import { stripPassword } from './services/shared.mjs';
import {
  buildStorageKey,
  createUploadUrl,
  detectAssetKind,
  objectExists,
  toPublicAssetUrl,
} from './r2.mjs';
import { getServerEnv } from './env.mjs';
import brandingDefaults from '../config/branding-defaults.json' with { type: 'json' };

const env = getServerEnv();
const SESSION_COOKIE_NAME = 'smx_platform_session';

function resolveAllowedOrigin(req) {
  const requestOrigin = typeof req.headers.origin === 'string' ? req.headers.origin : '';
  if (!requestOrigin) return env.allowedOrigin || '*';
  if (!env.allowedOrigin || env.allowedOrigin === requestOrigin) return requestOrigin;
  return env.allowedOrigin;
}

function buildCorsHeaders(req) {
  const allowedOrigin = resolveAllowedOrigin(req);
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Credentials': allowedOrigin === '*' ? 'false' : 'true',
    Vary: 'Origin',
  };
}

function sendJson(req, res, statusCode, payload, extraHeaders = {}) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'X-Request-Id': req.__smxRequestId || '',
    ...buildCorsHeaders(req),
    ...extraHeaders,
  });
  res.end(JSON.stringify(payload));
}

function finalizeRequest(req, statusCode, routeKey) {
  if (typeof req.__smxFinalize === 'function') {
    req.__smxFinalize(statusCode, routeKey);
  }
}

function resolveRouteKey(req, fallback) {
  return fallback || `${req.method || 'GET'} ${req.__smxPath || req.url || '/'}`;
}

function notFound(req, res, routeKey = '') {
  finalizeRequest(req, 404, resolveRouteKey(req, routeKey));
  sendJson(req, res, 404, { ok: false, message: 'Not found' });
}

function badRequest(req, res, message, routeKey = '') {
  finalizeRequest(req, 400, resolveRouteKey(req, routeKey));
  sendJson(req, res, 400, { ok: false, message });
}

function unauthorized(req, res, message = 'Unauthorized', routeKey = '') {
  finalizeRequest(req, 401, resolveRouteKey(req, routeKey));
  sendJson(req, res, 401, { ok: false, message });
}

function forbidden(req, res, message = 'Forbidden', routeKey = '') {
  finalizeRequest(req, 403, resolveRouteKey(req, routeKey));
  sendJson(req, res, 403, { ok: false, message });
}

function tooManyRequests(req, res, message = 'Too many requests', headers = {}, routeKey = '') {
  finalizeRequest(req, 429, resolveRouteKey(req, routeKey));
  sendJson(req, res, 429, { ok: false, message }, headers);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

function getBearerToken(req) {
  const header = req.headers.authorization;
  if (!header) return '';
  const [scheme, token] = header.split(/\s+/, 2);
  if (!scheme || scheme.toLowerCase() !== 'bearer') return '';
  return token?.trim() || '';
}

function parseCookies(req) {
  const raw = typeof req.headers.cookie === 'string' ? req.headers.cookie : '';
  if (!raw) return {};
  return raw.split(';').reduce((cookies, chunk) => {
    const [name, ...rest] = chunk.trim().split('=');
    if (!name) return cookies;
    cookies[name] = decodeURIComponent(rest.join('=') || '');
    return cookies;
  }, {});
}

function getSessionToken(req) {
  const bearerToken = getBearerToken(req);
  if (bearerToken) return bearerToken;
  return parseCookies(req)[SESSION_COOKIE_NAME] || '';
}

function buildSessionCookie(sessionId, persistenceMode) {
  const maxAgeSeconds = persistenceMode === 'local' ? 60 * 60 * 24 * 30 : 60 * 60 * 12;
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(sessionId)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAgeSeconds}`,
  ];
  if (env.cookieSecure) parts.push('Secure');
  return parts.join('; ');
}

function clearSessionCookie() {
  const parts = [
    `${SESSION_COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0',
    'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
  ];
  if (env.cookieSecure) parts.push('Secure');
  return parts.join('; ');
}

async function buildSessionPayload(session) {
  return {
    ok: true,
    session: {
      sessionId: session.sessionId,
      persistenceMode: session.session.persistenceMode,
      issuedAt: session.session.issuedAt,
      expiresAt: session.session.expiresAt,
    },
    user: stripPassword(session.user),
    activeClientId: session.activeClientId,
    permissions: session.permissions,
    clients: await listClientsForSession(session),
  };
}

async function requireSession(req, res) {
  const token = getSessionToken(req);
  if (!token) {
    unauthorized(req, res, 'Missing session token');
    return null;
  }
  const context = await getSessionContext(token);
  if (!context) {
    unauthorized(req, res, 'Session expired or invalid');
    return null;
  }
  return context;
}

function hydrateAssetUrls(asset) {
  if (!asset || asset.storageMode !== 'object-storage' || !asset.storageKey) return asset;
  const publicUrl = toPublicAssetUrl(asset.storageKey);
  return {
    ...asset,
    src: publicUrl,
    publicUrl,
    posterSrc: asset.kind === 'video' ? (asset.posterSrc || publicUrl) : publicUrl,
    thumbnailUrl: publicUrl,
  };
}

function normalizeAssetDraft(input = {}) {
  const sourceType = input.sourceType === 'url' || input.sourceType === 'upload' ? input.sourceType : undefined;
  const storageMode = input.storageMode === 'object-storage' || input.storageMode === 'remote-url'
    ? input.storageMode
    : (sourceType === 'url' ? 'remote-url' : 'object-storage');
  return {
    name: String(input.name || 'Untitled asset'),
    kind: input.kind || detectAssetKind(input.mimeType, input.name || input.src || 'asset.bin'),
    src: String(input.publicUrl || input.src || ''),
    mimeType: input.mimeType || undefined,
    sourceType: sourceType || (storageMode === 'remote-url' ? 'url' : 'upload'),
    storageMode,
    storageKey: input.storageKey || undefined,
    publicUrl: input.publicUrl || undefined,
    originUrl: input.originUrl || undefined,
    posterSrc: input.posterSrc || undefined,
    accessScope: input.accessScope === 'private' ? 'private' : 'client',
    tags: Array.isArray(input.tags) ? input.tags : [],
    folderId: typeof input.folderId === 'string' ? input.folderId : undefined,
    sizeBytes: typeof input.sizeBytes === 'number' ? input.sizeBytes : undefined,
    width: typeof input.width === 'number' ? input.width : undefined,
    height: typeof input.height === 'number' ? input.height : undefined,
    durationMs: typeof input.durationMs === 'number' ? input.durationMs : undefined,
    fingerprint: input.fingerprint || undefined,
    fontFamily: input.fontFamily || undefined,
  };
}

function validateLoginBody(body) {
  if (!body || typeof body !== 'object') return 'Body must be a JSON object';
  if (typeof body.email !== 'string' || !body.email.trim()) return 'Email is required';
  if (typeof body.password !== 'string' || !body.password.trim()) return 'Password is required';
  return '';
}

function validateStatePayload(body) {
  if (!body || typeof body !== 'object') return 'Body must be a JSON object';
  if (!('state' in body) || typeof body.state !== 'object' || body.state === null) return 'state is required';
  return '';
}

const server = createServer(async (req, res) => {
  const requestContext = createRequestContext(req);
  req.__smxRequestId = requestContext.requestId;

  const finalize = (statusCode, routeKey) => {
    if (req.__smxMetricFinalized) return;
    req.__smxMetricFinalized = true;
    if (!env.observabilityEnabled) return;
    const durationMs = Date.now() - requestContext.startedAtMs;
    void recordRequestMetric(routeKey, statusCode, durationMs).catch((error) => {
      logServerEvent('error', 'observability.metric_failed', {
        requestId: requestContext.requestId,
        route: routeKey,
        statusCode,
        message: error instanceof Error ? error.message : String(error),
      });
    });
    logServerEvent(statusCode >= 500 ? 'error' : 'info', 'http.request', {
      requestId: requestContext.requestId,
      method: requestContext.method,
      route: routeKey,
      statusCode,
      durationMs,
      repositoryDriver: getRepositoryMetadata().driver,
    });
  };

  if (!req.url || !req.method) return notFound(req, res);
  req.__smxFinalize = finalize;
  if (req.method === 'OPTIONS') {
    finalize(204, 'OPTIONS *');
    return sendJson(req, res, 204, {});
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const path = url.pathname;
  req.__smxPath = path;

  try {
    if (req.method === 'GET' && path === '/health') {
      finalize(200, 'GET /health');
      return sendJson(req, res, 200, { ok: true, service: 'smx-platform-api', bucket: env.bucket });
    }

    if (req.method === 'GET' && path === '/readyz') {
      try {
        const repository = await checkRepositoryReadiness();
        finalize(200, 'GET /readyz');
        return sendJson(req, res, 200, {
          ok: true,
          service: 'smx-platform-api',
          repository,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Repository not ready';
        finalize(503, 'GET /readyz');
        return sendJson(req, res, 503, {
          ok: false,
          service: 'smx-platform-api',
          message,
          repository: getRepositoryMetadata(),
        });
      }
    }

    if (req.method === 'GET' && path === '/version') {
      finalize(200, 'GET /version');
      return sendJson(req, res, 200, {
        ok: true,
        service: 'smx-platform-api',
        version: '0.2.0',
        repository: getRepositoryMetadata(),
      });
    }

    if (req.method === 'GET' && path === '/observability') {
      finalize(200, 'GET /observability');
      return sendJson(req, res, 200, {
        requestId: requestContext.requestId,
        repository: getRepositoryMetadata(),
        ...(await getObservabilitySnapshot()),
      });
    }

    if (req.method === 'POST' && path === '/auth/login') {
      const loginRateLimit = await consumeRateLimit('auth.login', getRequestRateLimitSubject(req), {
        limit: env.loginRateLimitMax,
        windowMs: env.loginRateLimitWindowMs,
      });
      if (!loginRateLimit.ok) {
        return tooManyRequests(req, res, 'Login rate limit exceeded', getRateLimitHeaders(loginRateLimit), 'POST /auth/login');
      }
      const body = await readBody(req);
      const validationError = validateLoginBody(body);
      if (validationError) return badRequest(req, res, validationError, 'POST /auth/login');
      const result = await authenticate(body.email || '', body.password || '', Boolean(body.remember));
      if (!result) return unauthorized(req, res, 'Invalid credentials', 'POST /auth/login');
      finalize(200, 'POST /auth/login');
      return sendJson(req, res, 200, result, {
        'Set-Cookie': buildSessionCookie(result.session.sessionId, result.session.persistenceMode),
      });
    }

    if (req.method === 'GET' && path === '/auth/session') {
      const session = await requireSession(req, res);
      if (!session) return;
      finalize(200, 'GET /auth/session');
      return sendJson(req, res, 200, await buildSessionPayload(session));
    }

    if (req.method === 'POST' && path === '/auth/logout') {
      const sessionToken = getSessionToken(req);
      if (sessionToken) await revokeSession(sessionToken);
      finalize(200, 'POST /auth/logout');
      return sendJson(req, res, 200, { ok: true }, {
        'Set-Cookie': clearSessionCookie(),
      });
    }

    if (path.startsWith('/clients')) {
      const session = await requireSession(req, res);
      if (!session) return;

      if (req.method === 'GET' && path === '/clients') {
        finalize(200, 'GET /clients');
        return sendJson(req, res, 200, { clients: await listClientsForSession(session), activeClientId: session.activeClientId });
      }

      if (req.method === 'POST' && path === '/clients') {
        const body = await readBody(req);
        if (!body?.name || typeof body.name !== 'string') return badRequest(req, res, 'name is required');
        const result = await createClientForSession(session, body.name);
        finalize(200, 'POST /clients');
        return sendJson(req, res, 200, { ok: true, ...result });
      }

      if (req.method === 'POST' && path === '/clients/active') {
        const body = await readBody(req);
        if (!body?.clientId || typeof body.clientId !== 'string') return badRequest(req, res, 'clientId is required');
        const result = await setActiveClientForSession(session, body.clientId);
        finalize(200, 'POST /clients/active');
        return sendJson(req, res, 200, { ok: true, ...result });
      }

      const clientBrandMatch = path.match(/^\/clients\/([^/]+)\/brands$/);
      if (req.method === 'POST' && clientBrandMatch) {
        const body = await readBody(req);
        if (!body?.name || typeof body.name !== 'string') return badRequest(req, res, 'name is required');
        const result = await addBrandToClientForSession(
          session,
          clientBrandMatch[1],
          body.name,
          typeof body.primaryColor === 'string' ? body.primaryColor : brandingDefaults.brandColor,
        );
        finalize(200, 'POST /clients/:id/brands');
        return sendJson(req, res, 200, { ok: true, ...result });
      }

      const clientInviteMatch = path.match(/^\/clients\/([^/]+)\/invites$/);
      if (req.method === 'POST' && clientInviteMatch) {
        const body = await readBody(req);
        if (!body?.email || typeof body.email !== 'string') return badRequest(req, res, 'email is required');
        const result = await inviteMemberToClientForSession(session, clientInviteMatch[1], body.email, body.role);
        finalize(200, 'POST /clients/:id/invites');
        return sendJson(req, res, 200, result);
      }
    }

    if (path.startsWith('/projects') || path.startsWith('/assets') || path.startsWith('/documents') || path.startsWith('/admin')) {
      const session = await requireSession(req, res);
      if (!session) return;

      if (req.method === 'GET' && path === '/projects') {
        finalize(200, 'GET /projects');
        return sendJson(req, res, 200, { projects: await listProjectsForSession(session) });
      }

      if (req.method === 'GET' && path === '/admin/audit-events') {
        try {
          const limit = Number(url.searchParams.get('limit') || '100');
          const action = String(url.searchParams.get('action') || '');
          const target = String(url.searchParams.get('target') || '');
          const clientId = String(url.searchParams.get('clientId') || '');
          const before = String(url.searchParams.get('before') || '');
          finalize(200, 'GET /admin/audit-events');
          return sendJson(req, res, 200, await listAuditEventsForSession(session, { limit, action, target, clientId, before }));
        } catch (error) {
          if (error instanceof Error && error.message.startsWith('Forbidden:')) return forbidden(req, res, error.message, 'GET /admin/audit-events');
          throw error;
        }
      }

      if (req.method === 'GET' && path === '/admin/assets/housekeeping') {
        try {
          finalize(200, 'GET /admin/assets/housekeeping');
          return sendJson(req, res, 200, await getAssetHousekeepingForSession(session));
        } catch (error) {
          if (error instanceof Error && error.message.startsWith('Forbidden:')) {
            return forbidden(req, res, error.message, 'GET /admin/assets/housekeeping');
          }
          throw error;
        }
      }

      if (req.method === 'POST' && path === '/admin/maintenance/cleanup-assets') {
        try {
          finalize(200, 'POST /admin/maintenance/cleanup-assets');
          return sendJson(req, res, 200, await cleanupAssetHousekeepingForSession(session));
        } catch (error) {
          if (error instanceof Error && error.message.startsWith('Forbidden:')) {
            return forbidden(req, res, error.message, 'POST /admin/maintenance/cleanup-assets');
          }
          throw error;
        }
      }

      if (req.method === 'POST' && path === '/admin/maintenance/cleanup-sessions') {
        try {
          if (session.user.role !== 'admin') return forbidden(req, res, 'Forbidden: maintenance requires admin access', 'POST /admin/maintenance/cleanup-sessions');
          const result = await cleanupExpiredSessions();
          finalize(200, 'POST /admin/maintenance/cleanup-sessions');
          return sendJson(req, res, 200, result);
        } catch (error) {
          if (error instanceof Error && error.message.startsWith('Forbidden:')) return forbidden(req, res, error.message, 'POST /admin/maintenance/cleanup-sessions');
          throw error;
        }
      }

      if (req.method === 'POST' && path === '/admin/maintenance/cleanup-drafts') {
        try {
          const body = await readBody(req);
          const result = await cleanupStaleDocumentSlots(session, {
            maxAgeDays: typeof body?.maxAgeDays === 'number' ? body.maxAgeDays : env.draftRetentionDays,
            scope: typeof body?.scope === 'string' ? body.scope : '',
          });
          finalize(200, 'POST /admin/maintenance/cleanup-drafts');
          return sendJson(req, res, 200, result);
        } catch (error) {
          if (error instanceof Error && error.message.startsWith('Forbidden:')) return forbidden(req, res, error.message, 'POST /admin/maintenance/cleanup-drafts');
          throw error;
        }
      }

      if (req.method === 'POST' && path === '/projects/save') {
        const body = await readBody(req);
        const validationError = validateStatePayload(body);
        if (validationError) return badRequest(req, res, validationError, 'POST /projects/save');
        const project = await saveProjectForSession(session, body.state ?? {}, body.projectId);
        finalize(200, 'POST /projects/save');
        return sendJson(req, res, 200, { project });
      }

      const projectLoadMatch = path.match(/^\/projects\/([^/]+)$/);
      if (req.method === 'GET' && projectLoadMatch) {
        finalize(200, 'GET /projects/:id');
        return sendJson(req, res, 200, { state: await loadProjectForSession(session, projectLoadMatch[1]) });
      }
      if (req.method === 'DELETE' && projectLoadMatch) {
        try {
          await deleteProjectForSession(session, projectLoadMatch[1]);
          finalize(200, 'DELETE /projects/:id');
          return sendJson(req, res, 200, { ok: true });
        } catch (error) {
          if (error instanceof Error && error.message.startsWith('Forbidden:')) return forbidden(req, res, error.message, 'DELETE /projects/:id');
          throw error;
        }
      }

      const projectDuplicateMatch = path.match(/^\/projects\/([^/]+)\/duplicate$/);
      if (req.method === 'POST' && projectDuplicateMatch) {
        try {
          const project = await duplicateProjectForSession(session, projectDuplicateMatch[1]);
          finalize(200, 'POST /projects/:id/duplicate');
          return sendJson(req, res, 200, { project });
        } catch (error) {
          if (error instanceof Error && (error.message.startsWith('Forbidden:') || error.message === 'Project not found')) return forbidden(req, res, error.message, 'POST /projects/:id/duplicate');
          throw error;
        }
      }

      const projectArchiveMatch = path.match(/^\/projects\/([^/]+)\/archive$/);
      if (req.method === 'POST' && projectArchiveMatch) {
        try {
          await archiveProjectForSession(session, projectArchiveMatch[1]);
          finalize(200, 'POST /projects/:id/archive');
          return sendJson(req, res, 200, { ok: true });
        } catch (error) {
          if (error instanceof Error && error.message.startsWith('Forbidden:')) return forbidden(req, res, error.message, 'POST /projects/:id/archive');
          throw error;
        }
      }

      const projectRestoreMatch = path.match(/^\/projects\/([^/]+)\/restore$/);
      if (req.method === 'POST' && projectRestoreMatch) {
        try {
          await restoreProjectForSession(session, projectRestoreMatch[1]);
          finalize(200, 'POST /projects/:id/restore');
          return sendJson(req, res, 200, { ok: true });
        } catch (error) {
          if (error instanceof Error && error.message.startsWith('Forbidden:')) return forbidden(req, res, error.message, 'POST /projects/:id/restore');
          throw error;
        }
      }

      const projectOwnerMatch = path.match(/^\/projects\/([^/]+)\/owner$/);
      if (req.method === 'POST' && projectOwnerMatch) {
        const body = await readBody(req);
        if (!body.ownerUserId || typeof body.ownerUserId !== 'string') return badRequest(req, res, 'ownerUserId is required', 'POST /projects/:id/owner');
        try {
          await changeProjectOwnerForSession(session, projectOwnerMatch[1], body.ownerUserId, typeof body.ownerName === 'string' ? body.ownerName : undefined);
          finalize(200, 'POST /projects/:id/owner');
          return sendJson(req, res, 200, { ok: true });
        } catch (error) {
          if (error instanceof Error && error.message.startsWith('Forbidden:')) return forbidden(req, res, error.message, 'POST /projects/:id/owner');
          throw error;
        }
      }

      const versionListMatch = path.match(/^\/projects\/([^/]+)\/versions$/);
      if (req.method === 'GET' && versionListMatch) {
        finalize(200, 'GET /projects/:id/versions');
        return sendJson(req, res, 200, { versions: await listProjectVersionsForSession(session, versionListMatch[1]) });
      }
      if (req.method === 'POST' && versionListMatch) {
        const body = await readBody(req);
        const validationError = validateStatePayload(body);
        if (validationError) return badRequest(req, res, validationError, 'POST /projects/:id/versions');
        try {
          const version = await saveProjectVersionForSession(session, versionListMatch[1], body.state ?? {}, typeof body.note === 'string' ? body.note : undefined);
          finalize(200, 'POST /projects/:id/versions');
          return sendJson(req, res, 200, { version });
        } catch (error) {
          if (error instanceof Error && error.message.startsWith('Forbidden:')) return forbidden(req, res, error.message, 'POST /projects/:id/versions');
          throw error;
        }
      }

      const versionLoadMatch = path.match(/^\/projects\/([^/]+)\/versions\/([^/]+)$/);
      if (req.method === 'GET' && versionLoadMatch) {
        finalize(200, 'GET /projects/:id/versions/:versionId');
        return sendJson(req, res, 200, { state: await loadProjectVersionForSession(session, versionLoadMatch[1], versionLoadMatch[2]) });
      }

      if (req.method === 'GET' && path === '/assets') {
        const assets = await listAssetsForSession(session);
        finalize(200, 'GET /assets');
        return sendJson(req, res, 200, { assets: assets.map(hydrateAssetUrls) });
      }

      if (req.method === 'GET' && path === '/assets/folders') {
        const folders = await listAssetFoldersForSession(session);
        finalize(200, 'GET /assets/folders');
        return sendJson(req, res, 200, { folders });
      }

      if (req.method === 'POST' && path === '/assets/folders') {
        const body = await readBody(req);
        if (typeof body.name !== 'string' || !body.name.trim()) return badRequest(req, res, 'name is required', 'POST /assets/folders');
        const folder = await createAssetFolderForSession(session, body.name, typeof body.parentId === 'string' ? body.parentId : undefined);
        finalize(200, 'POST /assets/folders');
        return sendJson(req, res, 200, { folder });
      }

      if (req.method === 'GET' && path === '/documents/autosave/exists') {
        finalize(200, 'GET /documents/autosave/exists');
        return sendJson(req, res, 200, { exists: await hasDocumentForSession(session, 'autosave') });
      }

      if (req.method === 'GET' && path === '/documents/manual-save/exists') {
        finalize(200, 'GET /documents/manual-save/exists');
        return sendJson(req, res, 200, { exists: await hasDocumentForSession(session, 'manual') });
      }

      if (req.method === 'GET' && path === '/documents/autosave') {
        finalize(200, 'GET /documents/autosave');
        return sendJson(req, res, 200, { state: await loadDocumentForSession(session, 'autosave') });
      }

      if (req.method === 'GET' && path === '/documents/manual-save') {
        finalize(200, 'GET /documents/manual-save');
        return sendJson(req, res, 200, { state: await loadDocumentForSession(session, 'manual') });
      }

      if (req.method === 'POST' && path === '/documents/autosave') {
        const body = await readBody(req);
        const validationError = validateStatePayload(body);
        if (validationError) return badRequest(req, res, validationError, 'POST /documents/autosave');
        await saveDocumentForSession(session, 'autosave', body.state ?? {});
        finalize(200, 'POST /documents/autosave');
        return sendJson(req, res, 200, { ok: true });
      }

      if (req.method === 'POST' && path === '/documents/manual-save') {
        const body = await readBody(req);
        const validationError = validateStatePayload(body);
        if (validationError) return badRequest(req, res, validationError, 'POST /documents/manual-save');
        await saveDocumentForSession(session, 'manual', body.state ?? {});
        finalize(200, 'POST /documents/manual-save');
        return sendJson(req, res, 200, { ok: true });
      }

      if (req.method === 'DELETE' && path === '/documents/autosave') {
        await clearDocumentForSession(session, 'autosave');
        finalize(200, 'DELETE /documents/autosave');
        return sendJson(req, res, 200, { ok: true });
      }

      if (req.method === 'DELETE' && path === '/documents/manual-save') {
        await clearDocumentForSession(session, 'manual');
        finalize(200, 'DELETE /documents/manual-save');
        return sendJson(req, res, 200, { ok: true });
      }

      if (req.method === 'POST' && path === '/assets') {
        const body = await readBody(req);
        const draft = normalizeAssetDraft(body.asset || {});
        const asset = hydrateAssetUrls(await saveAssetForSession(session, {
          ...draft,
          id: randomUUID(),
          createdAt: new Date().toISOString(),
        }));
        finalize(200, 'POST /assets');
        return sendJson(req, res, 200, { asset });
      }

      if (req.method === 'POST' && path === '/assets/upload-url') {
        const uploadRateLimit = await consumeRateLimit('assets.upload-url', getRequestRateLimitSubject(req), {
          limit: env.uploadRateLimitMax,
          windowMs: env.uploadRateLimitWindowMs,
        });
        if (!uploadRateLimit.ok) {
          return tooManyRequests(req, res, 'Upload preparation rate limit exceeded', getRateLimitHeaders(uploadRateLimit), 'POST /assets/upload-url');
        }
        const body = await readBody(req);
        const assetId = randomUUID();
        const filename = String(body.filename || 'asset.bin');
        if (!filename.trim()) return badRequest(req, res, 'filename is required', 'POST /assets/upload-url');
        const kind = body.kind || detectAssetKind(body.mimeType, filename);
        const storageKey = buildStorageKey({ assetId, clientId: session.activeClientId || 'client_default', filename });
        const uploadUrl = await createUploadUrl({ storageKey, mimeType: body.mimeType });
        finalize(200, 'POST /assets/upload-url');
        return sendJson(req, res, 200, {
          upload: {
            assetId,
            name: body.requestedName || filename,
            kind,
            mimeType: body.mimeType,
            sizeBytes: body.sizeBytes,
            accessScope: body.accessScope || 'client',
            tags: body.tags || [],
            folderId: body.folderId,
            fontFamily: body.fontFamily,
            storageMode: 'object-storage',
            storageKey,
            uploadUrl,
            publicUrl: toPublicAssetUrl(storageKey),
          },
        });
      }

      if (req.method === 'POST' && path === '/assets/complete-upload') {
        const uploadRateLimit = await consumeRateLimit('assets.complete-upload', getRequestRateLimitSubject(req), {
          limit: env.uploadRateLimitMax,
          windowMs: env.uploadRateLimitWindowMs,
        });
        if (!uploadRateLimit.ok) {
          return tooManyRequests(req, res, 'Upload completion rate limit exceeded', getRateLimitHeaders(uploadRateLimit), 'POST /assets/complete-upload');
        }
        const body = await readBody(req);
        if (!body.storageKey || typeof body.storageKey !== 'string') return badRequest(req, res, 'storageKey is required', 'POST /assets/complete-upload');
        const exists = await objectExists(body.storageKey);
        if (!exists) {
          finalize(404, 'POST /assets/complete-upload');
          return sendJson(req, res, 404, { ok: false, message: 'Uploaded object not found in R2.' });
        }
        const asset = hydrateAssetUrls(await saveAssetForSession(session, {
          id: body.assetId || randomUUID(),
          name: body.name || body.storageKey.split('/').pop() || body.assetId,
          kind: body.kind || detectAssetKind(body.mimeType, body.storageKey),
          src: body.publicUrl || toPublicAssetUrl(body.storageKey),
          createdAt: new Date().toISOString(),
          mimeType: body.mimeType,
          sourceType: body.sourceType || 'upload',
          storageMode: body.storageMode || 'object-storage',
          storageKey: body.storageKey,
          publicUrl: body.publicUrl || toPublicAssetUrl(body.storageKey),
          posterSrc: body.publicUrl || toPublicAssetUrl(body.storageKey),
          thumbnailUrl: body.publicUrl || toPublicAssetUrl(body.storageKey),
          accessScope: body.accessScope || 'client',
          tags: body.tags || [],
          folderId: body.folderId,
          sizeBytes: body.sizeBytes,
          width: body.metadata?.width ?? body.width,
          height: body.metadata?.height ?? body.height,
          durationMs: body.metadata?.durationMs ?? body.durationMs,
          fingerprint: body.metadata?.fingerprint ?? body.fingerprint,
          fontFamily: body.fontFamily,
        }));
        finalize(200, 'POST /assets/complete-upload');
        return sendJson(req, res, 200, { asset });
      }

      const assetSingleMatch = path.match(/^\/assets\/([^/]+)$/);
      if (req.method === 'GET' && assetSingleMatch) {
        const asset = await getAssetForSession(session, assetSingleMatch[1]);
        finalize(200, 'GET /assets/:id');
        return sendJson(req, res, 200, { asset: asset ? hydrateAssetUrls(asset) : undefined });
      }
      if (req.method === 'DELETE' && assetSingleMatch) {
        try {
          await deleteAssetForSession(session, assetSingleMatch[1], {
            purgeBinary: ['1', 'true', 'yes'].includes(String(url.searchParams.get('purge') || '').toLowerCase()),
          });
          finalize(200, 'DELETE /assets/:id');
          return sendJson(req, res, 200, { ok: true });
        } catch (error) {
          if (error instanceof Error && error.message.startsWith('Forbidden:')) return forbidden(req, res, error.message, 'DELETE /assets/:id');
          throw error;
        }
      }

      const assetRenameMatch = path.match(/^\/assets\/([^/]+)\/rename$/);
      if (req.method === 'POST' && assetRenameMatch) {
        const body = await readBody(req);
        const name = String(body.name || '').trim();
        try {
          const asset = await renameAssetForSession(session, assetRenameMatch[1], name);
          if (!asset) {
            finalize(404, 'POST /assets/:id/rename');
            return sendJson(req, res, 404, { ok: false, message: 'Asset not found' });
          }
          finalize(200, 'POST /assets/:id/rename');
          return sendJson(req, res, 200, { asset: hydrateAssetUrls(asset) });
        } catch (error) {
          if (error instanceof Error && error.message.startsWith('Forbidden:')) return forbidden(req, res, error.message, 'POST /assets/:id/rename');
          throw error;
        }
      }
    }

    return notFound(req, res, `${req.method} ${path}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected server error';
    if (typeof message === 'string' && message.startsWith('Forbidden:')) return forbidden(req, res, message, `${req.method} ${path}`);
    finalize(500, `${req.method} ${path}`);
    logServerEvent('error', 'http.error', {
      requestId: requestContext.requestId,
      method: requestContext.method,
      route: `${req.method} ${path}`,
      message,
      repositoryDriver: getRepositoryMetadata().driver,
    });
    return sendJson(req, res, 500, { ok: false, message });
  }
});

server.listen(env.port, env.host, () => {
  logServerEvent('info', 'server.started', {
    host: env.host,
    port: env.port,
    repositoryDriver: getRepositoryMetadata().driver,
    observabilityEnabled: env.observabilityEnabled,
  });
});
