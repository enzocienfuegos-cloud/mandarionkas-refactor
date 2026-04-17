import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiProjectRepository } from '../../../repositories/project/api';

const fetchMock = vi.fn();

describe('api project repository', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    localStorage.clear();
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('fails clearly when no API base is configured', async () => {
    await expect(apiProjectRepository.list()).rejects.toThrow('Project API unavailable');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('uses remote API when base URL is configured', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.com');
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => [{ id: 'remote_1', name: 'Remote Project', updatedAt: '2026-01-01T00:00:00.000Z', clientId: 'client_remote', ownerUserId: 'user_1', accessScope: 'client' }] });

    const listed = await apiProjectRepository.list();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain('https://api.example.com/projects');
    expect(listed[0]?.id).toBe('remote_1');
  });
});
