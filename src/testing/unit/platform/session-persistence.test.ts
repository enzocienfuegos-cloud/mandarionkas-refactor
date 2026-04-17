import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readPlatformState } from '../../../platform/repository';
import { hydratePlatformState } from '../../../platform/state';
import { platformStore } from '../../../platform/store';

function resetPlatform(): void {
  globalThis.localStorage.clear();
  globalThis.sessionStorage.clear();
  hydratePlatformState();
}

describe('platform session persistence', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    resetPlatform();
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.com');
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('does not persist sensitive session records in localStorage', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      ok: true,
      session: {
        sessionId: 'session_admin',
        persistenceMode: 'local',
        issuedAt: '2026-04-17T00:00:00.000Z',
        expiresAt: '2026-05-17T00:00:00.000Z',
      },
      user: {
        id: 'user_admin',
        name: 'SMX Admin',
        email: 'admin@smx.studio',
        role: 'admin',
      },
      activeClientId: 'client_default',
      permissions: ['projects:save'],
      clients: [{
        id: 'client_default',
        name: 'Default Client',
        slug: 'default-client',
        ownerUserId: 'user_admin',
        memberUserIds: ['user_admin'],
        members: [{ userId: 'user_admin', role: 'owner', addedAt: '2026-04-17T00:00:00.000Z' }],
        invites: [],
        brands: [],
      }],
    })));
    const login = await platformStore.login('admin@smx.studio', 'demo123', { remember: true });
    expect(login.ok).toBe(true);

    const persisted = readPlatformState();
    expect(persisted.session.isAuthenticated).toBe(false);
    expect(globalThis.localStorage.getItem('smx-studio-v4:platform-session')).toBeNull();
  });

  it('does not persist ephemeral session records in sessionStorage either', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      ok: true,
      session: {
        sessionId: 'session_editor',
        persistenceMode: 'session',
        issuedAt: '2026-04-17T00:00:00.000Z',
        expiresAt: '2026-04-18T00:00:00.000Z',
      },
      user: {
        id: 'user_editor',
        name: 'Client Editor',
        email: 'editor@smx.studio',
        role: 'editor',
      },
      activeClientId: 'client_default',
      permissions: ['projects:save'],
      clients: [{
        id: 'client_default',
        name: 'Default Client',
        slug: 'default-client',
        ownerUserId: 'user_admin',
        memberUserIds: ['user_admin', 'user_editor'],
        members: [
          { userId: 'user_admin', role: 'owner', addedAt: '2026-04-17T00:00:00.000Z' },
          { userId: 'user_editor', role: 'editor', addedAt: '2026-04-17T00:00:00.000Z' },
        ],
        invites: [],
        brands: [],
      }],
    })));
    const login = await platformStore.login('editor@smx.studio', 'demo123', { remember: false });
    expect(login.ok).toBe(true);

    expect(globalThis.localStorage.getItem('smx-studio-v4:platform-session')).toBeNull();
    expect(globalThis.sessionStorage.getItem('smx-studio-v4:platform-session')).toBeNull();
  });
});
