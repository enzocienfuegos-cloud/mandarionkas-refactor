import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createInitialState } from '../../../domain/document/factories';
import { platformStore } from '../../../platform/store';
import { apiProjectRepository } from '../../../repositories/project/api';
import { localProjectRepository } from '../../../repositories/project/local';

const fetchMock = vi.fn();

describe('api project repository', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    localStorage.clear();
    fetchMock.mockReset();
    platformStore.login('admin@smx.studio', 'demo123');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('falls back to local repository when no API base is configured', async () => {
    const state = createInitialState();
    state.document.name = 'Local Only';
    const project = await localProjectRepository.save(state);

    const listed = await apiProjectRepository.list();
    expect(listed.some((item) => item.id === project.id)).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('uses remote API when base URL is configured', async () => {
    localStorage.setItem('smx-studio-v4:project-api-base', 'https://api.example.com');
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => [{ id: 'remote_1', name: 'Remote Project', updatedAt: '2026-01-01T00:00:00.000Z', clientId: 'client_remote', ownerUserId: 'user_1', accessScope: 'client' }] });

    const listed = await apiProjectRepository.list();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain('https://api.example.com/projects');
    expect(listed[0]?.id).toBe('remote_1');
  });
});
