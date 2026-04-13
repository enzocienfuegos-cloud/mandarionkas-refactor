import { appendAuditEntry, clearPlatformSessionStorage, createAuditEntry } from './repository';
import { getPlatformState, updatePlatformState } from './state';
import { requestPlatformLogin, requestPlatformLogout, requestPlatformSession } from './api';
import type { LoginResponseDto, SessionResponseDto } from '../types/contracts';

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
          expiresAt: payload.session.expiresAt,
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

export async function restoreSession(): Promise<void> {
  const response = await requestPlatformSession();
  if (!response) return;

  if (!response.authenticated) {
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
    return;
  }

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
    return { ok: false, message: 'Platform API unavailable.' };
  }

  if (!response.ok) {
    return { ok: false, message: response.message ?? 'Invalid credentials' };
  }

  applySessionPayload(response, 'session.login');
  return { ok: true };
}

export async function logout(): Promise<void> {
  await requestPlatformLogout();

  const state = getPlatformState();
  const actor = state.session.currentUser;

  clearPlatformSessionStorage();

  updatePlatformState((current) =>
    appendAuditEntry(
      {
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
      },
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
