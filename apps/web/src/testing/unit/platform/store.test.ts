import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { hydratePlatformState } from '../../../platform/state';
import { platformStore } from '../../../platform/store';

function resetPlatform(): void {
  globalThis.localStorage.clear();
  globalThis.sessionStorage.clear();
  hydratePlatformState();
}

describe('platform store', () => {
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

  it('logs in demo admin and exposes permissions', async () => {
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
      permissions: ['clients:create', 'projects:save', 'assets:create'],
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

    const result = await platformStore.login('admin@smx.studio', 'demo123');
    expect(result.ok).toBe(true);
    expect(platformStore.getState().session.isAuthenticated).toBe(true);
    expect(platformStore.getState().session.permissions.length).toBeGreaterThan(0);
    expect(platformStore.getState().auditLog[0]?.action).toBe('session.login');
  });

  it('creates a client workspace for authorized user', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({
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
        permissions: ['clients:create', 'projects:save', 'assets:create'],
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
      })))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        ok: true,
        activeClientId: 'client_qa',
        client: {
          id: 'client_qa',
          name: 'Client QA',
          slug: 'client-qa',
          ownerUserId: 'user_admin',
          memberUserIds: ['user_admin'],
          members: [{ userId: 'user_admin', role: 'owner', addedAt: '2026-04-17T00:00:00.000Z' }],
          invites: [],
          brands: [],
        },
        clients: [
          {
            id: 'client_default',
            name: 'Default Client',
            slug: 'default-client',
            ownerUserId: 'user_admin',
            memberUserIds: ['user_admin'],
            members: [{ userId: 'user_admin', role: 'owner', addedAt: '2026-04-17T00:00:00.000Z' }],
            invites: [],
            brands: [],
          },
          {
            id: 'client_qa',
            name: 'Client QA',
            slug: 'client-qa',
            ownerUserId: 'user_admin',
            memberUserIds: ['user_admin'],
            members: [{ userId: 'user_admin', role: 'owner', addedAt: '2026-04-17T00:00:00.000Z' }],
            invites: [],
            brands: [],
          },
        ],
      })));

    await platformStore.login('admin@smx.studio', 'demo123');
    const created = await platformStore.createClient('Client QA');
    expect(created?.name).toBe('Client QA');
    expect(platformStore.getState().session.activeClientId).toBe(created?.id);
    expect(platformStore.getState().auditLog[0]?.action).toBe('client.create');
  });
});
