import { randomUUID } from 'node:crypto';
import { getPool } from '../../../../../packages/db/src/pool.mjs';
import { signOpaqueToken, verifyOpaqueToken, verifyPassword } from '../../../../../packages/config/src/security.mjs';
import { parseCookies, serializeCookie } from '../../lib/cookies.mjs';
import { listWorkspacesForUser, setSessionActiveWorkspace, userHasWorkspaceAccess } from '../workspaces/service.mjs';

const SESSION_COOKIE_NAME = 'smx_session';
const REMEMBER_TTL_SECONDS = 60 * 60 * 24 * 30;
const SESSION_TTL_SECONDS = 60 * 60 * 12;

const ROLE_PERMISSIONS = {
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
  ],
  editor: [
    'projects:create',
    'projects:view-client',
    'projects:save',
    'projects:share-client',
    'assets:create',
    'assets:view-client',
    'assets:update',
    'brandkits:manage',
    'clients:invite',
  ],
  reviewer: ['projects:view-client', 'assets:view-client'],
};

function now() {
  return new Date();
}

function getRuntimeConnectionString(env) {
  return env.databasePoolUrl || env.databaseUrl || '';
}

function getClientIp(headers) {
  const forwarded = Array.isArray(headers['x-forwarded-for']) ? headers['x-forwarded-for'][0] : headers['x-forwarded-for'] || '';
  const direct = Array.isArray(headers['x-real-ip']) ? headers['x-real-ip'][0] : headers['x-real-ip'] || '';
  return String(forwarded || direct).split(',')[0].trim() || null;
}

function toPublicUser(row) {
  return {
    id: row.user_id || row.id,
    name: row.display_name,
    email: row.email,
    role: row.global_role,
  };
}

function toAuthPayload({ sessionId, persistenceMode, issuedAt, expiresAt, user, activeWorkspaceId, workspaces }) {
  return {
    ok: true,
    authenticated: true,
    session: {
      sessionId,
      persistenceMode,
      issuedAt,
      expiresAt,
    },
    user,
    activeClientId: activeWorkspaceId,
    activeWorkspaceId,
    permissions: ROLE_PERMISSIONS[user.role] || [],
    clients: workspaces,
    workspaces,
  };
}

function unauthenticatedPayload() {
  return {
    ok: true,
    authenticated: false,
    session: null,
    user: null,
    activeClientId: undefined,
    activeWorkspaceId: undefined,
    permissions: [],
    clients: [],
    workspaces: [],
  };
}

function buildSessionCookie(env, sessionId, persistenceMode) {
  const secure = env.nodeEnv !== 'development' && env.appEnv !== 'development';
  const token = signOpaqueToken(sessionId, env.sessionSecret);
  return serializeCookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure,
    sameSite: 'None',
    path: '/',
    ...(persistenceMode === 'local' ? { maxAge: REMEMBER_TTL_SECONDS } : {}),
  });
}

export function buildClearedSessionCookie(env) {
  const secure = env.nodeEnv !== 'development' && env.appEnv !== 'development';
  return serializeCookie(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    secure,
    sameSite: 'None',
    path: '/',
    maxAge: 0,
  });
}

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

async function hydrateSession(client, sessionRow) {
  const workspaces = await listWorkspacesForUser(client, sessionRow.user_id);
  let activeWorkspaceId = sessionRow.active_workspace_id || workspaces[0]?.id;
  if (activeWorkspaceId) {
    const stillAllowed = workspaces.some((workspace) => workspace.id === activeWorkspaceId);
    if (!stillAllowed) {
      activeWorkspaceId = workspaces[0]?.id;
    }
  }
  if (activeWorkspaceId && activeWorkspaceId !== sessionRow.active_workspace_id) {
    await setSessionActiveWorkspace(client, {
      sessionId: sessionRow.id,
      workspaceId: activeWorkspaceId,
      userId: sessionRow.user_id,
    });
  } else {
    await client.query('update sessions set last_seen_at = now() where id = $1', [sessionRow.id]);
  }

  const user = toPublicUser(sessionRow);
  return toAuthPayload({
    sessionId: sessionRow.id,
    persistenceMode: sessionRow.persistence_mode,
    issuedAt: sessionRow.created_at.toISOString(),
    expiresAt: sessionRow.expires_at.toISOString(),
    user,
    activeWorkspaceId,
    workspaces,
  });
}

async function readSessionRowFromCookie(client, env, headers) {
  const cookies = parseCookies(headers);
  const rawToken = cookies[SESSION_COOKIE_NAME];
  const sessionId = verifyOpaqueToken(rawToken, env.sessionSecret);
  if (!sessionId) return null;

  const result = await client.query(
    `
      select s.id, s.user_id, s.active_workspace_id, s.expires_at, s.created_at, s.persistence_mode,
             u.email, u.display_name, u.global_role
      from sessions s
      join users u on u.id = s.user_id
      where s.id = $1
        and s.revoked_at is null
        and s.expires_at > now()
      limit 1
    `,
    [sessionId],
  );
  return result.rows[0] || null;
}

export async function restoreSessionFromRequest({ env, headers }) {
  if (!isAuthRuntimeReady(env)) {
    return {
      statusCode: 503,
      payload: { ok: false, code: 'service_unavailable', message: 'Auth runtime is not configured yet.' },
      clearCookie: false,
    };
  }

  const pool = getPoolOrThrow(env);
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

  const normalizedEmail = String(email || '').trim().toLowerCase();
  const normalizedPassword = String(password || '');
  const persistenceMode = remember ? 'local' : 'session';
  const ttlSeconds = remember ? REMEMBER_TTL_SECONDS : SESSION_TTL_SECONDS;
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

  const pool = getPoolOrThrow(env);
  const client = await pool.connect();
  try {
    const userResult = await client.query(
      `
        select id, email, password_hash, display_name, global_role
        from users
        where lower(email) = $1
        limit 1
      `,
      [normalizedEmail],
    );
    const userRow = userResult.rows[0];
    if (!userRow) {
      return { statusCode: 401, payload: { ok: false, message: 'Invalid email or password.' } };
    }

    const valid = await verifyPassword(normalizedPassword, userRow.password_hash);
    if (!valid) {
      return { statusCode: 401, payload: { ok: false, message: 'Invalid email or password.' } };
    }

    const workspaces = await listWorkspacesForUser(client, userRow.id);
    const activeWorkspaceId = workspaces[0]?.id;
    const sessionId = randomUUID();

    await client.query(
      `
        insert into sessions (
          id,
          user_id,
          active_workspace_id,
          expires_at,
          ip_address,
          user_agent,
          persistence_mode
        )
        values ($1, $2, $3, $4, $5, $6, $7)
      `,
      [
        sessionId,
        userRow.id,
        activeWorkspaceId || null,
        expiresAt,
        getClientIp(headers),
        Array.isArray(headers['user-agent']) ? headers['user-agent'][0] : headers['user-agent'] || null,
        persistenceMode,
      ],
    );

    const payload = toAuthPayload({
      sessionId,
      persistenceMode,
      issuedAt: now().toISOString(),
      expiresAt: expiresAt.toISOString(),
      user: toPublicUser(userRow),
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

  const pool = getPoolOrThrow(env);
  const client = await pool.connect();
  try {
    const sessionRow = await readSessionRowFromCookie(client, env, headers);
    if (sessionRow) {
      await client.query('update sessions set revoked_at = now() where id = $1', [sessionRow.id]);
    }
    return { statusCode: 204, cookie: buildClearedSessionCookie(env) };
  } finally {
    client.release();
  }
}

export async function requireAuthenticatedSession({ env, headers }) {
  if (!isAuthRuntimeReady(env)) {
    return { ok: false, statusCode: 503, code: 'service_unavailable', message: 'Auth runtime is not configured yet.' };
  }

  const pool = getPoolOrThrow(env);
  const client = await pool.connect();
  try {
    const sessionRow = await readSessionRowFromCookie(client, env, headers);
    if (!sessionRow) {
      return { ok: false, statusCode: 401, code: 'unauthorized', message: 'Authentication is required.' };
    }

    const workspaces = await listWorkspacesForUser(client, sessionRow.user_id);
    let activeWorkspaceId = sessionRow.active_workspace_id || workspaces[0]?.id;
    if (activeWorkspaceId && !workspaces.some((workspace) => workspace.id === activeWorkspaceId)) {
      activeWorkspaceId = workspaces[0]?.id;
    }
    if (activeWorkspaceId && activeWorkspaceId !== sessionRow.active_workspace_id) {
      await setSessionActiveWorkspace(client, {
        sessionId: sessionRow.id,
        workspaceId: activeWorkspaceId,
        userId: sessionRow.user_id,
      });
    } else {
      await client.query('update sessions set last_seen_at = now() where id = $1', [sessionRow.id]);
    }

    return {
      ok: true,
      client,
      session: {
        id: sessionRow.id,
        userId: sessionRow.user_id,
        activeWorkspaceId,
        persistenceMode: sessionRow.persistence_mode,
        issuedAt: sessionRow.created_at.toISOString(),
        expiresAt: sessionRow.expires_at.toISOString(),
      },
      user: toPublicUser(sessionRow),
      workspaces,
      permissions: ROLE_PERMISSIONS[sessionRow.global_role] || [],
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
