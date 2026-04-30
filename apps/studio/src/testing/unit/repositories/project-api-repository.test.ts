import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createInitialState } from '../../../domain/document/factories';
import { apiProjectRepository } from '../../../repositories/project/api';

const PROJECT_API_BASE = 'https://api.example.com';

const PROJECT_SUMMARY = {
  id: 'remote_1',
  name: 'Remote Project',
  clientId: 'client_remote',
  ownerUserId: 'user_1',
  accessScope: 'client',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('api project repository', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('throws when no API base is configured', async () => {
    const state = createInitialState();
    await expect(apiProjectRepository.save(state)).rejects.toThrow();
  });

  it('throws when no API base is configured for list', async () => {
    await expect(apiProjectRepository.list()).rejects.toThrow();
  });

  it('uses remote API when base URL is configured', async () => {
    localStorage.setItem('smx-studio-v4:project-api-base', PROJECT_API_BASE);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => [PROJECT_SUMMARY],
    });
    vi.stubGlobal('fetch', fetchMock);

    const listed = await apiProjectRepository.list();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain('https://api.example.com/v1/projects');
    expect(listed[0]?.id).toBe('remote_1');
  });
});
