import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { hydratePlatformState } from '../../../platform/state';
import { platformStore } from '../../../platform/store';

function resetPlatform(): void {
  globalThis.localStorage.clear();
  globalThis.sessionStorage.clear();
  hydratePlatformState();
}

function getRetailClientId(): string {
  const retail = platformStore.getState().clients.find((client) => client.name === 'Retail Group');
  if (!retail) throw new Error('Retail Group client not found');
  return retail.id;
}

describe('platform auth flows', () => {
  const fetchMock = vi.fn();

  beforeEach(async () => {
    resetPlatform();
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.com');
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
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
      activeClientId: 'client_retail',
      permissions: ['clients:create', 'clients:invite', 'projects:save', 'assets:create'],
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
          id: 'client_retail',
          name: 'Retail Group',
          slug: 'retail-group',
          ownerUserId: 'user_admin',
          memberUserIds: ['user_admin', 'user_reviewer'],
          members: [
            { userId: 'user_admin', role: 'owner', addedAt: '2026-04-17T00:00:00.000Z' },
            { userId: 'user_reviewer', role: 'reviewer', addedAt: '2026-04-17T00:00:00.000Z' },
          ],
          invites: [],
          brands: [],
        },
      ],
    })));
    await platformStore.login('admin@smx.studio', 'demo123');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('invites a new pending member to the active workspace', async () => {
    const clientId = getRetailClientId();
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({
        ok: true,
        activeClientId: clientId,
        clients: platformStore.getState().clients,
      })))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        ok: true,
        message: 'Invitation sent',
        clients: platformStore.getState().clients.map((client) => client.id === clientId
          ? {
              ...client,
              invites: [
                ...(client.invites ?? []),
                {
                  id: 'invite_new',
                  email: 'new.user@example.com',
                  role: 'reviewer',
                  status: 'pending',
                  invitedAt: '2026-04-17T00:00:00.000Z',
                },
              ],
            }
          : client),
      })));

    await platformStore.setActiveClient(clientId);
    const result = await platformStore.inviteMember(clientId, 'new.user@example.com', 'reviewer');

    expect(result.ok).toBe(true);
    const client = platformStore.getState().clients.find((item) => item.id === clientId);
    expect(client?.invites?.some((invite) => invite.email === 'new.user@example.com' && invite.status === 'pending')).toBe(true);
    expect(platformStore.getState().auditLog[0]?.action).toBe('client.member.invite');
  });

  it('adds an existing reviewer user directly to the workspace', async () => {
    const clientId = getRetailClientId();
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({
        ok: true,
        activeClientId: clientId,
        clients: platformStore.getState().clients,
      })))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        ok: true,
        message: 'Member added',
        clients: platformStore.getState().clients,
      })));

    await platformStore.setActiveClient(clientId);
    const result = await platformStore.inviteMember(clientId, 'reviewer@smx.studio', 'reviewer');

    expect(result.ok).toBe(true);
    const client = platformStore.getState().clients.find((item) => item.id === clientId);
    expect(client?.invites?.some((invite) => invite.email === 'reviewer@smx.studio')).toBe(false);
    expect(client?.members?.some((member) => member.role === 'reviewer')).toBe(true);
    expect(platformStore.workspaceRole(clientId)).toBe('owner');
  });
});
