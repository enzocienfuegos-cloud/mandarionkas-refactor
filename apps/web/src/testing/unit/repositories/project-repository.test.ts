import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createInitialState } from '../../../domain/document/factories';
import { platformStore } from '../../../platform/store';
import { browserStorageProjectRepository } from '../../fakes/browser-storage-project-repository';

const STORAGE_KEY_PREFIX = 'smx-studio-v4:';

describe('browser storage project repository', () => {
  const fetchMock = vi.fn();

  beforeEach(async () => {
    const keys = Object.keys(localStorage).filter((key) => key.startsWith(STORAGE_KEY_PREFIX));
    keys.forEach((key) => localStorage.removeItem(key));
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
      activeClientId: 'client_default',
      permissions: ['projects:save', 'projects:view-client', 'projects:delete', 'projects:share-client'],
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
    await platformStore.login('admin@smx.studio', 'demo123');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('saves and loads projects', async () => {
    const state = createInitialState();
    state.document.name = 'Project State';

    const project = await browserStorageProjectRepository.save(state);
    const loaded = await browserStorageProjectRepository.load(project.id);
    expect(loaded?.document.name).toBe('Project State');

    const listed = await browserStorageProjectRepository.list();
    expect(listed.some((item) => item.id === project.id)).toBe(true);
  });
});
