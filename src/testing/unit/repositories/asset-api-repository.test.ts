import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { platformStore } from '../../../platform/store';
import { apiAssetRepository } from '../../../repositories/asset/api';

const fetchMock = vi.fn();

describe('api asset repository', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    localStorage.clear();
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('fails clearly when asset API base is missing', async () => {
    await expect(apiAssetRepository.list()).rejects.toThrow('Asset API unavailable');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('strips transient payload fields before posting to the API', async () => {
    vi.stubEnv('VITE_ASSET_API_BASE_URL', 'https://assets.example.com');
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ asset: { id: 'asset_remote', name: 'Remote Hero', kind: 'image', src: 'https://cdn.example.com/remote.jpg', publicUrl: 'https://cdn.example.com/remote.jpg', storageMode: 'object-storage', clientId: 'client_default', ownerUserId: 'anonymous', createdAt: '2026-04-10T00:00:00.000Z' } }) });

    await apiAssetRepository.save({
      name: 'Remote Hero',
      kind: 'image',
      src: '',
      storageMode: 'object-storage',
      storageKey: 'remote/key',
      storagePayload: 'data:image/png;base64,AAA',
      sourceType: 'upload',
    });

    expect(fetchMock).toHaveBeenCalled();
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(String(init.body)).not.toContain('storagePayload');
  });

  it('fetches remote assets when API base exists', async () => {
    vi.stubEnv('VITE_ASSET_API_BASE_URL', 'https://assets.example.com');
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ assets: [{ id: 'asset_remote', name: 'Remote Hero', kind: 'image', src: 'https://cdn.example.com/remote.jpg', publicUrl: 'https://cdn.example.com/remote.jpg', clientId: 'client_default', ownerUserId: 'anonymous', createdAt: '2026-04-10T00:00:00.000Z' }] }) });

    const listed = await apiAssetRepository.list();
    expect(String(fetchMock.mock.calls[0][0])).toContain('https://assets.example.com/assets');
    expect(listed[0]?.id).toBe('asset_remote');
  });
});
