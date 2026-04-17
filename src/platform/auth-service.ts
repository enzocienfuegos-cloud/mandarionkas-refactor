import { getRolePermissions } from './role-permissions';
import { appendAuditEntry, clearPlatformSessionStorage, createAuditEntry, createSessionRecord } from './repository';
import { getPlatformState, updatePlatformState } from './state';
import type { PlatformState, SessionPersistenceMode } from './types';
import { requestPlatformLogin, requestPlatformLogout } from './api';

type PublicUser = PlatformState['session']['currentUser'];

type LoginOptions = {
  remember?: boolean;
};

function sanitizeUser(user: PlatformState['users'][number]): NonNullable<PublicUser> {
  const { password, ...safe } = user;
  return safe;
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

  updatePlatformState((current) =>
    appendAuditEntry(
      {
        ...current,
        users: response.clients.length
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
          : current.users,
        clients: response.clients.map((client) => ({
          ...client,
          invites: current.clients.find((entry) => entry.id === client.id)?.invites ?? [],
          brands: current.clients.find((entry) => entry.id === client.id)?.brands ?? [],
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
      },
      createAuditEntry({
        action: 'session.login',
        target: 'session',
        actor: response.user,
        clientId: response.activeClientId,
        targetId: response.session.sessionId,
        summary: `${response.user.name} logged in via API`,
      }),
    ),
  );

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