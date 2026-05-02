// apps/api/src/modules/auth/service.mjs
//
// Auth service — Sprint 51 definitive rewrite.
//
// Changes from S50 local uncommitted version:
//   - ROLE_PERMISSION_MATRIX is the single source of truth (mirrors
//     packages/contracts/src/platform.ts — kept in sync manually until the
//     API is TypeScript end-to-end).
//   - resolveProductAccess() enforces the ceiling rule:
//     platform_role determines the maximum; workspace product_access can only
//     narrow, never expand.
//   - toAuthPayload() always emits productAccess so consumers never need to
//     fallback-infer it from workspace rows.
//   - requireAuthenticatedSession() returns the resolved productAccess so
//     route modules don't recompute it.
//   - No legacy 'editor' role handling at runtime — migration 0021 has
//     already normalised all rows to the new vocabulary.

import { randomUUID } from 'node:crypto';
import { getPool } from '@smx/db/src/pool.mjs';
import {
  signOpaqueToken,
  verifyOpaqueToken,
  verifyPassword,
} from '@smx/config/src/security.mjs';
import { parseCookies, serializeCookie } from '../../lib/cookies.mjs';
import {
  listWorkspacesForUser,
  setSessionActiveWorkspace,
  userHasWorkspaceAccess,
} from '../workspaces/service.mjs';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SESSION_COOKIE_NAME = 'smx_session';
const REMEMBER_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days
const SESSION_TTL_SECONDS = 60 * 60 * 12;        // 12 hours

// ---------------------------------------------------------------------------
// Role → permission matrix
// Must stay in sync with packages/contracts/src/platform.ts
// ---------------------------------------------------------------------------

const ROLE_PERMISSION_MATRIX = /** @type {Record<string, string[]>} */ ({
  admin: [
    'clients:create',
    'clients:update',
    'clients:invite',
    'clients:manage-members',
    'projects:create',
    'projects:view-client',
    'projects:save',
    'projects:delete',
    'projects:share-client',
    'assets:create',
    'assets:view-client',
    'assets:update',
    'assets:delete',
    'assets:manage-client',
    'brandkits:manage',
    'release:manage',
    'audit:read',
    'adserver:access',
    'studio:access',
  ],
  ad_ops: [
    'projects:view-client',
    'assets:view-client',
    'audit:read',
    'adserver:access',
  ],
  designer: [
    'projects:create',
    'projects:view-client',
    'projects:save',
    'projects:share-client',
    'assets:create',
    'assets:view-client',
    'assets:update',
    'brandkits:manage',
    'clients:invite',
    'studio:access',
  ],
  reviewer: [
    'projects:view-client',
    'assets:view-client',
    'adserver:access',
    'studio:access',
  ],
});

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function now() {
  return new Date();
}

function getRuntimeConnectionString(env) {
  return env.databasePoolUrl || env.databaseUrl || '';
}

function getClientIp(headers) {
  const forwarded = Array.isArray(headers['x-forwarded-for'])
    ? headers['x-forwarded-for'][0]
    : headers['x-forwarded-for'] || '';
  const direct = Array.isArray(headers['x-real-ip'])
    ? headers['x-real-ip'][0]
    : headers['x-real-ip'] || '';
  return String(forwarded || direct).split(',')[0].trim() || null;
}

function isMissingPlatformRoleColumnError(error) {
  return (
    error?.code === '42703' && /platform_role/i.test(String(error?.message || ''))
  );
}

/**
 * Normalises a raw DB role string to a valid PlatformRole.
 * Falls back to 'reviewer' (least privilege).
 */
function normalizePlatformRole(raw) {
  const role = String(raw ?? '').trim().toLowerCase();
  if (role === 'admin')    return 'admin';
  if (role === 'ad_ops')   return 'ad_ops';
  if (role === 'designer') return 'designer';
  if (role === 'reviewer') return 'reviewer';
  return 'reviewer';
}

/**
 * Returns the permission list for a given role.
 */
function getPermissionsForRole(role) {
  return ROLE_PERMISSION_MATRIX[normalizePlatformRole(role)] ?? ROLE_PERMISSION_MATRIX.reviewer;
}

/**
 * Resolves the effective product access for a user.
 *
 * Rule: platform_role is the ceiling.
 *       workspace product_access can only narrow, never expand.
 *
 * @param {string} platformRole
 * @param {{ ad_server?: boolean; studio?: boolean } | null} workspaceAccess
 * @returns {{ ad_server: boolean; studio: boolean }}
 */
function resolveProductAccess(platformRole, workspaceAccess) {
  const perms = ROLE_PERMISSION_MATRIX[normalizePlatformRole(platformRole)] ?? [];
  const roleAdServer = perms.includes('adserver:access');
  const roleStudio   = perms.includes('studio:access');

  const ws = workspaceAccess && typeof workspaceAccess === 'object'
    ? workspaceAccess
    : { ad_server: true, studio: true };

  return {
    ad_server: roleAdServer && (ws.ad_server !== false),
    studio:    roleStudio   && (ws.studio    !== false),
  };
}

function toPublicUser(row) {
  return {
    id:           row.user_id || row.id,
    email:        row.email,
    name:         row.display_name,
    role:         normalizePlatformRole(row.platform_role || row.global_role),
    platformRole: normalizePlatformRole(row.platform_role || row.global_role),
  };
}

function toAuthPayload({
  sessionId,
  persistenceMode,
  issuedAt,
  expiresAt,
  user,
  activeWorkspaceId,
  workspaces,
}) {
  const activeWorkspace =
    workspaces.find((ws) => ws.id === activeWorkspaceId) ?? workspaces[0] ?? null;

  const resolvedAccess = resolveProductAccess(
    user.role,
    activeWorkspace?.product_access ?? null,
  );

  return {
    ok: true,
    authenticated: true,
    session: { sessionId, persistenceMode, issuedAt, expiresAt },
    user,
    activeClientId:    activeWorkspaceId,
    activeWorkspaceId,
    productAccess:     resolvedAccess,
    permissions:       getPermissionsForRole(user.role),
    clients:           workspaces,
    workspaces,
  };
}

function unauthenticatedPayload() {
  return {
    ok:                true,
    authenticated:     false,
    session:           null,
    user:              null,
    activeClientId:    undefined,
    activeWorkspaceId: undefined,
    productAccess:     null,
    permissions:       [],
    clients:           [],
    workspaces:        [],
  };
}

function buildSessionCookie(env, sessionId, persistenceMode) {
  const secure = env.nodeEnv !== 'development' && env.appEnv !== 'development';
  const token  = signOpaqueToken(sessionId, env.sessionSecret);
  return serializeCookie(SESSION_COOKIE_NAME, token, {
    httpOnly:  true,
    secure,
    sameSite:  'None',
    path:      '/',
    ...(persistenceMode === 'local' ? { maxAge: REMEMBER_TTL_SECONDS } : {}),
  });
}

export function buildClearedSessionCookie(env) {
  const secure = env.nodeEnv !== 'development' && env.appEnv !== 'development';
  return serializeCookie(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    secure,
    sameSite: 'None',
    path:     '/',
    maxAge:   0,
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function isAuthRuntimeReady(env) {
  return Boolean(getRuntimeConnectionString(env) && env.sessionSecret);
}

export function getPoolOrThrow(env) {
  const connectionString = getRuntimeConnectionString(env);
  if (!connectionString) {
    throw new Error('DATABASE_URL or DATABASE_POOL_URL is required.');
  }
  return getPool(connectionString);
}

async function readSessionRowFromCookie(client, env, headers) {
  const cookies   = parseCookies(headers);
  const rawToken  = cookies[SESSION_COOKIE_NAME];
  const sessionId = verifyOpaqueToken(rawToken, env.sessionSecret);
  if (!sessionId) return null;

  let result;
  try {
    result = await client.query(
      `SELECT s.id, s.user_id, s.active_workspace_id, s.expires_at,
              s.created_at, s.persistence_mode,
              u.email, u.display_name, u.platform_role
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.id = $1
         AND s.revoked_at IS NULL
         AND s.expires_at > now()
       LIMIT 1`,
      [sessionId],
    );
  } catch (error) {
    if (!isMissingPlatformRoleColumnError(error)) throw error;
    // DB hasn't run migration 0021 yet — graceful degradation
    result = await client.query(
      `SELECT s.id, s.user_id, s.active_workspace_id, s.expires_at,
              s.created_at, s.persistence_mode,
              u.email, u.display_name, u.global_role,
              null::text AS platform_role
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.id = $1
         AND s.revoked_at IS NULL
         AND s.expires_at > now()
       LIMIT 1`,
      [sessionId],
    );
  }
  return result.rows[0] ?? null;
}

async function hydrateSession(client, sessionRow) {
  const workspaces       = await listWorkspacesForUser(client, sessionRow.user_id);
  let activeWorkspaceId  = sessionRow.active_workspace_id ?? workspaces[0]?.id;

  if (activeWorkspaceId) {
    const stillAllowed = workspaces.some((ws) => ws.id === activeWorkspaceId);
    if (!stillAllowed) activeWorkspaceId = workspaces[0]?.id;
  }

  if (activeWorkspaceId && activeWorkspaceId !== sessionRow.active_workspace_id) {
    await setSessionActiveWorkspace(client, {
      sessionId:   sessionRow.id,
      workspaceId: activeWorkspaceId,
      userId:      sessionRow.user_id,
    });
  } else {
    await client.query(
      'UPDATE sessions SET last_seen_at = now() WHERE id = $1',
      [sessionRow.id],
    );
  }

  return toAuthPayload({
    sessionId:         sessionRow.id,
    persistenceMode:   sessionRow.persistence_mode,
    issuedAt:          sessionRow.created_at.toISOString(),
    expiresAt:         sessionRow.expires_at.toISOString(),
    user:              toPublicUser(sessionRow),
    activeWorkspaceId,
    workspaces,
  });
}

export async function restoreSessionFromRequest({ env, headers }) {
  if (!isAuthRuntimeReady(env)) {
    return {
      statusCode: 503,
      payload: { ok: false, code: 'service_unavailable', message: 'Auth runtime is not configured yet.' },
      clearCookie: false,
    };
  }

  const pool   = getPoolOrThrow(env);
  const client = await pool.connect();
  try {
    const sessionRow = await readSessionRowFromCookie(client, env, headers);
    if (!sessionRow) {
      return { statusCode: 200, payload: unauthenticatedPayload(), clearCookie: true };
    }
    return { statusCode: 200, payload: await hydrateSession(client, sessionRow), clearCookie: false };
  } finally {
    client.release();
  }
}

export async function createLoginSession({ env, email, password, remember, headers }) {
  if (!isAuthRuntimeReady(env)) {
    return {
      statusCode: 503,
      payload: { ok: false, code: 'service_unavailable', message: 'Auth runtime is not configured yet.' },
    };
  }

  const normalizedEmail    = String(email ?? '').trim().toLowerCase();
  const normalizedPassword = String(password ?? '');
  const persistenceMode    = remember ? 'local' : 'session';
  const ttlSeconds         = remember ? REMEMBER_TTL_SECONDS : SESSION_TTL_SECONDS;
  const expiresAt          = new Date(Date.now() + ttlSeconds * 1000);

  const pool   = getPoolOrThrow(env);
  const client = await pool.connect();
  try {
    let userResult;
    try {
      userResult = await client.query(
        `SELECT id, email, password_hash, display_name, platform_role
         FROM users
         WHERE lower(email) = $1
         LIMIT 1`,
        [normalizedEmail],
      );
    } catch (error) {
      if (!isMissingPlatformRoleColumnError(error)) throw error;
      userResult = await client.query(
        `SELECT id, email, password_hash, display_name,
                global_role, null::text AS platform_role
         FROM users
         WHERE lower(email) = $1
         LIMIT 1`,
        [normalizedEmail],
      );
    }

    const userRow = userResult.rows[0];
    if (!userRow) {
      return { statusCode: 401, payload: { ok: false, message: 'Invalid email or password.' } };
    }

    const valid = await verifyPassword(normalizedPassword, userRow.password_hash);
    if (!valid) {
      return { statusCode: 401, payload: { ok: false, message: 'Invalid email or password.' } };
    }

    const workspaces      = await listWorkspacesForUser(client, userRow.id);
    const activeWorkspaceId = workspaces[0]?.id;
    const sessionId       = randomUUID();

    await client.query(
      `INSERT INTO sessions (
         id, user_id, active_workspace_id, expires_at,
         ip_address, user_agent, persistence_mode
       ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        sessionId,
        userRow.id,
        activeWorkspaceId ?? null,
        expiresAt,
        getClientIp(headers),
        Array.isArray(headers['user-agent'])
          ? headers['user-agent'][0]
          : headers['user-agent'] ?? null,
        persistenceMode,
      ],
    );

    const payload = toAuthPayload({
      sessionId,
      persistenceMode,
      issuedAt:          now().toISOString(),
      expiresAt:         expiresAt.toISOString(),
      user:              toPublicUser(userRow),
      activeWorkspaceId,
      workspaces,
    });

    return {
      statusCode: 200,
      payload,
      cookie: buildSessionCookie(env, sessionId, persistenceMode),
    };
  } finally {
    client.release();
  }
}

export async function revokeSessionFromRequest({ env, headers }) {
  if (!isAuthRuntimeReady(env)) {
    return { statusCode: 204, cookie: buildClearedSessionCookie(env) };
  }

  const pool   = getPoolOrThrow(env);
  const client = await pool.connect();
  try {
    const sessionRow = await readSessionRowFromCookie(client, env, headers);
    if (sessionRow) {
      await client.query(
        'UPDATE sessions SET revoked_at = now() WHERE id = $1',
        [sessionRow.id],
      );
    }
    return { statusCode: 204, cookie: buildClearedSessionCookie(env) };
  } finally {
    client.release();
  }
}

/**
 * Validates the session cookie and returns a fully hydrated session context.
 * Used as the primary auth guard in all protected route modules.
 *
 * Returns { ok: false } on any auth failure — never throws to the caller.
 */
export async function requireAuthenticatedSession({ env, headers }) {
  if (!isAuthRuntimeReady(env)) {
    return {
      ok:         false,
      statusCode: 503,
      code:       'service_unavailable',
      message:    'Auth runtime is not configured yet.',
    };
  }

  const pool   = getPoolOrThrow(env);
  const client = await pool.connect();
  try {
    const sessionRow = await readSessionRowFromCookie(client, env, headers);
    if (!sessionRow) {
      return {
        ok:         false,
        statusCode: 401,
        code:       'unauthorized',
        message:    'Authentication is required.',
      };
    }

    const workspaces      = await listWorkspacesForUser(client, sessionRow.user_id);
    let activeWorkspaceId = sessionRow.active_workspace_id ?? workspaces[0]?.id;
    if (activeWorkspaceId && !workspaces.some((ws) => ws.id === activeWorkspaceId)) {
      activeWorkspaceId = workspaces[0]?.id;
    }

    if (activeWorkspaceId && activeWorkspaceId !== sessionRow.active_workspace_id) {
      await setSessionActiveWorkspace(client, {
        sessionId:   sessionRow.id,
        workspaceId: activeWorkspaceId,
        userId:      sessionRow.user_id,
      });
    } else {
      await client.query(
        'UPDATE sessions SET last_seen_at = now() WHERE id = $1',
        [sessionRow.id],
      );
    }

    const user            = toPublicUser(sessionRow);
    const activeWorkspace = workspaces.find((ws) => ws.id === activeWorkspaceId) ?? null;
    const productAccess   = resolveProductAccess(user.role, activeWorkspace?.product_access ?? null);
    const permissions     = getPermissionsForRole(user.role);

    return {
      ok: true,
      client,
      session: {
        id:               sessionRow.id,
        userId:           sessionRow.user_id,
        activeWorkspaceId,
        persistenceMode:  sessionRow.persistence_mode,
        issuedAt:         sessionRow.created_at.toISOString(),
        expiresAt:        sessionRow.expires_at.toISOString(),
      },
      user,
      workspaces,
      productAccess,
      permissions,
      /** Must be called in a finally block after the route handler finishes. */
      async finish() {
        client.release();
      },
    };
  } catch (error) {
    client.release();
    throw error;
  }
}

export async function ensureWorkspaceAccess(client, workspaceId, userId) {
  return userHasWorkspaceAccess(client, workspaceId, userId);
}
