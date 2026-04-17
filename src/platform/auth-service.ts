import { appendAuditEntry, clearPlatformSessionStorage, createAuditEntry } from './repository';
import { getPlatformState, updatePlatformState } from './state';
import type { PlatformState } from './types';
import { requestPlatformLogin, requestPlatformLogout, requestPlatformSession } from './api';
import type { LoginResponseDto } from '../types/contracts';

type LoginOptions = {
  remember?: boolean;
};

function buildAuthenticatedState(current: PlatformState, response: LoginResponseDto): PlatformState {
  const existingUser = current.users.find((user) => user.email.toLowerCase() === response.user.email.toLowerCase());
  const nextUsers = existingUser
    ? current.users.map((user) => {
        if (user.email.toLowerCase() === response.user.email.toLowerCase()) {
          return {
            ...user,
            id: response.user.id,
            name: response.user.name,
            email: response.user.email,
            role: response.user.role,
          };
        }
        return user;
      })
    : [
        ...current.users,
        {
          id: response.user.id,
          name: response.user.name,
          email: response.user.email,
          password: '',
          role: response.user.role,
        },
      ];
  return {
    ...current,
    users: nextUsers,
    clients: response.clients.map((client) => ({
      ...client,
      invites: current.clients.find((entry) => entry.id === client.id)?.invites ?? client.invites ?? [],
      brands: current.clients.find((entry) => entry.id === client.id)?.brands ?? client.brands ?? [],
    })),
    session: {
      currentUser: response.user,
      activeClientId: response.activeClientId,
      isAuthenticated: true,
      permissions: response.permissions,
      sessionId: response.session.sessionId,
      persistenceMode: response.session.persistenceMode,
      issuedAt: response.session.issuedAt,
      expiresAt: response.session.expiresAt,
    },
  };
}

function clearSessionState(withAudit: boolean): void {
  const state = getPlatformState();
  const actor = state.session.currentUser;

  clearPlatformSessionStorage();

  updatePlatformState((current) => {
    const nextState: PlatformState = {
      ...current,
      session: {
        currentUser: undefined,
        activeClientId: current.session.activeClientId,
        isAuthenticated: false,
        permissions: [],
        sessionId: undefined,
        persistenceMode: undefined,
        issuedAt: undefined,
        expiresAt: undefined,
      },
    };

    if (!withAudit) return nextState;

    return appendAuditEntry(
      nextState,
      createAuditEntry({
        action: 'session.logout',
        target: 'session',
        actor,
        clientId: state.session.activeClientId,
        summary: `${actor?.name ?? 'User'} logged out`,
      }),
    );
  });
}

function applyLogin(response: LoginResponseDto, withAudit: boolean): void {
  updatePlatformState((current) => {
    const nextState = buildAuthenticatedState(current, response);
    if (!withAudit) return nextState;
    return appendAuditEntry(
      nextState,
      createAuditEntry({
        action: 'session.login',
        target: 'session',
        actor: response.user,
        clientId: response.activeClientId,
        targetId: response.session.sessionId,
        summary: `${response.user.name} logged in via API`,
      }),
    );
  });
}

export async function login(
  email: string,
  password: string,
  options: LoginOptions = {},
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

  applyLogin(response, true);
  return { ok: true };
}

export async function logout(): Promise<void> {
  await requestPlatformLogout();
  clearSessionState(true);
}

export async function restoreSession(): Promise<boolean> {
  const response = await requestPlatformSession();
  if (!response?.ok) {
    clearSessionState(false);
    return false;
  }
  applyLogin(response, false);
  return true;
}
