import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createInitialState } from '../../domain/document/factories';
import { reduceBySlices } from '../../core/store/reducers';
import { platformStore } from '../../platform/store';
import { apiProjectRepository } from '../../repositories/project/api';


describe('workspace project smoke path', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    globalThis.localStorage.clear();
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.com');
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });

  afterEach(async () => {
    await platformStore.logout();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('creates a client workspace, saves a project, lists it, and loads it back', async () => {
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
        permissions: ['clients:create', 'projects:save'],
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
        activeClientId: 'client_smoke',
        client: {
          id: 'client_smoke',
          name: 'Smoke Workspace',
          slug: 'smoke-workspace',
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
            id: 'client_smoke',
            name: 'Smoke Workspace',
            slug: 'smoke-workspace',
            ownerUserId: 'user_admin',
            memberUserIds: ['user_admin'],
            members: [{ userId: 'user_admin', role: 'owner', addedAt: '2026-04-17T00:00:00.000Z' }],
            invites: [],
            brands: [],
          },
        ],
      })))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        ok: true,
        activeClientId: 'client_smoke',
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
            id: 'client_smoke',
            name: 'Smoke Workspace',
            slug: 'smoke-workspace',
            ownerUserId: 'user_admin',
            memberUserIds: ['user_admin'],
            members: [{ userId: 'user_admin', role: 'owner', addedAt: '2026-04-17T00:00:00.000Z' }],
            invites: [],
            brands: [],
          },
        ],
      })));

    const login = await platformStore.login('admin@smx.studio', 'demo123');
    expect(login.ok).toBe(true);

    const client = await platformStore.createClient('Smoke Workspace');
    expect(client?.name).toBe('Smoke Workspace');
    await platformStore.setActiveClient(client!.id);

    let state = createInitialState();
    state = reduceBySlices(state, { type: 'UPDATE_DOCUMENT_NAME', name: 'Workspace Smoke Project' });
    state = reduceBySlices(state, {
      type: 'UPDATE_DOCUMENT_PLATFORM_METADATA',
      patch: {
        clientId: client!.id,
        clientName: client!.name,
        brandName: 'SignalMix',
        campaignName: 'Smoke Campaign',
        accessScope: 'client',
      },
    });

    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({
        project: {
          id: 'project_smoke',
          name: 'Workspace Smoke Project',
          updatedAt: '2026-04-17T00:00:00.000Z',
          clientId: client!.id,
          ownerUserId: 'user_admin',
          accessScope: 'client',
        },
      })))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        projects: [{
          id: 'project_smoke',
          name: 'Workspace Smoke Project',
          updatedAt: '2026-04-17T00:00:00.000Z',
          clientId: client!.id,
          ownerUserId: 'user_admin',
          accessScope: 'client',
        }],
      })))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        state,
      })));

    const summary = await apiProjectRepository.save(state);
    expect(summary.name).toBe('Workspace Smoke Project');

    const listed = await apiProjectRepository.list();
    expect(listed.some((item) => item.id === summary.id)).toBe(true);

    const loaded = await apiProjectRepository.load(summary.id);
    expect(loaded?.document.name).toBe('Workspace Smoke Project');
    expect(loaded?.document.metadata.platform.clientId).toBe(client!.id);
    expect(loaded?.document.metadata.platform.campaignName).toBe('Smoke Campaign');
  });
});
