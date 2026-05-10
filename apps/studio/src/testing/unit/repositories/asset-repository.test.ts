import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiAssetRepository } from '../../../repositories/asset/api';

const ASSET_API_BASE = 'https://api.example.com';

const ASSET_FIXTURE = {
  id: 'asset_1',
  name: 'Hero',
  kind: 'image',
  src: 'https://cdn.example.com/hero.png',
  clientId: 'client_1',
  ownerUserId: 'user_1',
  createdAt: new Date().toISOString(),
};

describe('api asset repository', () => {
  beforeEach(() => {
    globalThis.localStorage.clear();
    localStorage.setItem('smx-studio-v4:asset-api-base', ASSET_API_BASE);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('lists assets via GET — expects {assets:[]} envelope', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ assets: [ASSET_FIXTURE] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const listed = await apiAssetRepository.list();
    expect(listed.some((a) => a.id === 'asset_1')).toBe(true);
    expect(String(fetchMock.mock.calls[0][0])).toContain('/v1/assets');
  });

  it('renames an asset via POST to /assets/:id/rename', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ asset: { ...ASSET_FIXTURE, name: 'Hero Updated' } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await apiAssetRepository.rename('asset_1', 'Hero Updated');
    expect(String(fetchMock.mock.calls[0][0])).toContain('/v1/assets/asset_1/rename');
    expect(fetchMock.mock.calls[0][1]?.method).toBe('POST');
  });

  it('removes an asset via DELETE to /assets/:id', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204, json: async () => null });
    vi.stubGlobal('fetch', fetchMock);

    await apiAssetRepository.remove('asset_1');
    expect(fetchMock.mock.calls[0][1]?.method).toBe('DELETE');
    expect(String(fetchMock.mock.calls[0][0])).toContain('/v1/assets/asset_1');
  });
});
