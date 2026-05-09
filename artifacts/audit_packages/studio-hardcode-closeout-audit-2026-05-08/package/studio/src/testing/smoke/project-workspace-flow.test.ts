import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createInitialState } from '../../domain/document/factories';
import { reduceBySlices } from '../../core/store/reducers';
import { platformStore } from '../../platform/store';
import { apiProjectRepository } from '../../repositories/project/api';
import {
  setPlatformApiBase,
  buildLoginResponse,
  buildCreateClientResponse,
  PLATFORM_API_BASE,
  DEMO_WORKSPACES,
} from '../helpers/api-mocks';

describe('workspace project smoke path', () => {
  beforeEach(() => {
    globalThis.localStorage.clear();
    setPlatformApiBase();
    localStorage.setItem('smx-studio-v4:project-api-base', PLATFORM_API_BASE);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('logs in, creates a workspace, saves and loads a project via API', async () => {
    const clientResp = buildCreateClientResponse('Smoke Workspace');
    const clientId = clientResp.client.id;

    const setActiveClientResp = {
      ok: true,
      activeClientId: clientId,
      activeWorkspaceId: clientId,
      clients: [...DEMO_WORKSPACES, clientResp.client],
      workspaces: [...DEMO_WORKSPACES, clientResp.client],
    };

    const projectSummary = {
      id: 'proj_smoke_1',
      name: 'Workspace Smoke Project',
      clientId,
      ownerUserId: 'user_admin',
      accessScope: 'client',
      updatedAt: new Date().toISOString(),
    };

    const loadedState = createInitialState();
    loadedState.document.name = 'Workspace Smoke Project';

    // API call order:
    // 1. login         → AuthSessionPayloadDto
    // 2. createClient  → CreateClientResponseDto
    // 3. setActiveClient → UpdateActiveClientResponseDto
    // 4. project save  → { project: ProjectSummary }
    // 5. project list  → ProjectSummary[]
    // 6. project load  → { state: StudioState }
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => buildLoginResponse('owner') })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => clientResp })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => setActiveClientResp })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ project: projectSummary }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => [projectSummary] })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ state: loadedState }) });

    vi.stubGlobal('fetch', fetchMock);

    await platformStore.login('admin@smx.studio', 'demo123');
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
        campaignName: 'Smoke Campaign',
        accessScope: 'client',
      },
    });

    const summary = await apiProjectRepository.save(state);
    expect(summary.name).toBe('Workspace Smoke Project');

    const listed = await apiProjectRepository.list();
    expect(listed.some((item) => item.id === 'proj_smoke_1')).toBe(true);

    const loaded = await apiProjectRepository.load('proj_smoke_1');
    expect(loaded?.document.name).toBe('Workspace Smoke Project');
    expect(fetchMock).toHaveBeenCalledTimes(6);
  });
});
