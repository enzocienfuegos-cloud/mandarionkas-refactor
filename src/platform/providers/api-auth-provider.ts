import { appendAuditEntry, clearPlatformSessionStorage, createAuditEntry } from '../repository';
import { getPlatformState, updatePlatformState } from '../state';
import type { PlatformAuthProvider } from '../provider';
import { requestPlatformLogin, requestPlatformLogout } from '../api';
import type { LoginResponseDto } from '../../types/contracts';

function applyLoginResponse(payload: LoginResponseDto): void {
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
        action: 'session.login',
        target: 'session',
        actor: payload.user,
        clientId: payload.activeClientId,
        targetId: payload.session.sessionId,
        summary: `${payload.user.name} logged in via API`,
      }),
    ),
  );
}

export const apiAuthProvider: PlatformAuthProvider = {
  mode: 'api',
  async login(email, password, options) {
    const response = await requestPlatformLogin({ email, password, remember: options?.remember });
    if (!response) return { ok: false, message: 'Platform API unavailable.' };
    if (!response.ok) return { ok: false, message: response.message ?? 'Invalid credentials' };
    applyLoginResponse(response);
    return { ok: true };
  },
  async logout() {
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
  },
};
