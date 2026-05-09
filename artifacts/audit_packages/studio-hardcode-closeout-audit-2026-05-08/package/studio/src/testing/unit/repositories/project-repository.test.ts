import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createInitialState } from '../../../domain/document/factories';
import { apiProjectRepository } from '../../../repositories/project/api';

const PROJECT_API_BASE = 'https://api.example.com';

const PROJECT_SUMMARY = {
  id: 'proj_1',
  name: 'Project State',
  clientId: 'client_1',
  ownerUserId: 'user_1',
  accessScope: 'client',
  updatedAt: new Date().toISOString(),
};

describe('api project repository', () => {
  beforeEach(() => {
    globalThis.localStorage.clear();
    localStorage.setItem('smx-studio-v4:project-api-base', PROJECT_API_BASE);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('saves a project via POST — expects {project:{}} envelope', async () => {
    const state = createInitialState();
    state.document.name = 'Project State';

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ project: PROJECT_SUMMARY }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const saved = await apiProjectRepository.save(state);
    expect(saved.name).toBe('Project State');
    expect(String(fetchMock.mock.calls[0][0])).toContain('/v1/projects/save');
  });

  it('lists projects via GET — accepts array or {projects:[]} envelope', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => [PROJECT_SUMMARY],
    });
    vi.stubGlobal('fetch', fetchMock);

    const listed = await apiProjectRepository.list();
    expect(listed.some((item) => item.id === 'proj_1')).toBe(true);
    expect(String(fetchMock.mock.calls[0][0])).toContain('/v1/projects');
  });
});
