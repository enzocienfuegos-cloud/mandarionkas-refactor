import { appendAuditEntry, clearPlatformSessionStorage, createAuditEntry } from './repository';
import { getPlatformState, updatePlatformState } from './state';
import { requestPlatformLogin, requestPlatformLogout, requestPlatformSession } from './api';
import { APP_ENV } from '../config/runtime';
import { setAssetRepositoryMode, setDocumentRepositoryMode, setProjectRepositoryMode } from '../repositories/mode';
import { getRolePermissions } from './role-permissions';
import type { LoginResponseDto, SessionResponseDto } from '@smx/contracts';
import type { PlatformPermission } from './types';

const DEV_DEMO_USERS = {
  'admin@smx.studio': { id: 'user_admin', name: 'Admin User', email: 'admin@smx.studio', role: 'owner' as const },
  'editor@smx.studio': { id: 'user_editor', name: 'Editor User', email: 'editor@smx.studio', role: 'editor' as const },
};

const DEV_DEMO_CLIENTS = [
  {
    id: 'ws_retail',
    name: 'Retail Group',
    slug: 'retail-group',
    ownerUserId: 'user_admin',
    memberUserIds: ['user_admin', 'user_editor'],
    members: [
      { userId: 'user_admin', role: 'owner' as const, addedAt: '2026-01-01T00:00:00.000Z' },
      { userId: 'user_editor', role: 'editor' as const, addedAt: '2026-01-01T00:00:00.000Z' },
    ],
    invites: [],
    brands: [],
  },
  {
    id: 'ws_demo',
    name: 'Demo Agency',
    slug: 'demo-agency',
    ownerUserId: 'user_admin',
    memberUserIds: ['user_admin'],
    members: [
      { userId: 'user_admin', role: 'owner' as const, addedAt: '2026-01-01T00:00:00.000Z' },
    ],
    invites: [],
    brands: [],
  },
];

function clearSessionState() {
  updatePlatformState((current) => ({
    ...current,
    clients: [],
    session: {
      currentUser: undefined,
      activeClientId: undefined,
      isAuthenticated: false,
      permissions: [],
      sessionId: undefined,
      persistenceMode: undefined,
      issuedAt: undefined,
      expiresAt: undefined,
    },
  }));
}

function applySessionPayload(payload: Extract<LoginResponseDto | SessionResponseDto, { ok: true; authenticated: true }>, auditAction: 'session.login' | 'session.bootstrap') {
  updatePlatformState((current) =>
    appendAuditEntry(
      {
        ...current,
        clients: payload.clients,
        session: {
          currentUser: payload.user,
          activeClientId: payload.activeClientId,
          isAuthenticated: true,
          permissions: payload.permissions,
          sessionId: payload.session.sessionId,
          persistenceMode: payload.session.persistenceMode,
          issuedAt: payload.session.issuedAt,
          expiresAt: payload.session.expiresAt ?? undefined,
        },
      },
      createAuditEntry({
        action: auditAction,
        target: 'session',
        actor: payload.user,
        clientId: payload.activeClientId,
        targetId: payload.session.sessionId,
        summary: auditAction === 'session.bootstrap'
          ? `${payload.user.name} restored a cookie-backed session`
          : `${payload.user.name} logged in via API`,
      }),
    ),
  );
}

function buildDevDemoLoginPayload(
  email: string,
  remember: boolean | undefined,
): Extract<LoginResponseDto, { ok: true; authenticated: true }> | null {
  if (APP_ENV === 'production') return null;
  const normalizedEmail = email.trim().toLowerCase();
  const user = DEV_DEMO_USERS[normalizedEmail as keyof typeof DEV_DEMO_USERS];
  if (!user) return null;
  return {
    ok: true,
    authenticated: true,
    session: {
      sessionId: `sess_${user.role}_dev_fallback`,
      persistenceMode: remember ? 'local' : 'session',
      issuedAt: new Date().toISOString(),
      expiresAt: remember ? new Date(Date.now() + (1000 * 60 * 60 * 24 * 30)).toISOString() : null,
    },
    user,
    activeClientId: DEV_DEMO_CLIENTS[0].id,
    activeWorkspaceId: DEV_DEMO_CLIENTS[0].id,
    permissions: getRolePermissions(user.role) as PlatformPermission[],
    clients: DEV_DEMO_CLIENTS,
    workspaces: DEV_DEMO_CLIENTS,
  };
}

function setRepositoryModes(mode: 'local' | 'api'): void {
  setProjectRepositoryMode(mode);
  setDocumentRepositoryMode(mode);
  setAssetRepositoryMode(mode);
}

export async function restoreSession(): Promise<void> {
  const response = await requestPlatformSession();

  if (!response || !response.authenticated) {
    updatePlatformState((current) => current.session.isAuthenticated
      ? current
      : {
          ...current,
          clients: [],
          session: {
            currentUser: undefined,
            activeClientId: undefined,
            isAuthenticated: false,
            permissions: [],
            sessionId: undefined,
            persistenceMode: undefined,
            issuedAt: undefined,
            expiresAt: undefined,
          },
        });
    return;
  }

  setRepositoryModes('api');
  applySessionPayload(response, 'session.bootstrap');
}

export async function login(
  email: string,
  password: string,
  options: { remember?: boolean } = {},
): Promise<{ ok: boolean; message?: string }> {
  const response = await requestPlatformLogin({
    email,
    password,
    remember: options.remember,
  });

  if (!response) {
    const fallback = password === 'demo123'
      ? buildDevDemoLoginPayload(email, options.remember)
      : null;
    if (fallback) {
      setRepositoryModes('local');
      applySessionPayload(fallback, 'session.login');
      return { ok: true };
    }
    return { ok: false, message: APP_ENV === 'development' ? 'Platform API unavailable. Use a seed user in local dev or start the backend.' : 'Platform API unavailable.' };
  }

  if (!response.ok) {
    return { ok: false, message: response.message ?? 'Invalid credentials' };
  }

  setRepositoryModes('api');
  applySessionPayload(response, 'session.login');
  return { ok: true };
}

export async function logout(): Promise<void> {
  await requestPlatformLogout();
  setRepositoryModes('api');

  const state = getPlatformState();
  const actor = state.session.currentUser;

  clearPlatformSessionStorage();
  clearSessionState();

  updatePlatformState((current) =>
    appendAuditEntry(
      current,
      createAuditEntry({
        action: 'session.logout',
        target: 'session',
        actor,
        clientId: state.session.activeClientId,
        summary: `${actor?.name ?? 'User'} logged out`,
      }),
    ),
  );
}
