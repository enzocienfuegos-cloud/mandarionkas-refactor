import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiBrandKitRepository } from '../../../repositories/brand-kit/api';

const BRAND_KIT_API_BASE = 'https://api.example.com';

const BRAND_KIT_FIXTURE = {
  id: 'kit_remote_1',
  workspaceId: 'client_remote',
  name: 'Remote Brand Kit',
  brandName: 'Remote Brand',
  colors: { accent: '#ff6600' },
  typography: { fontFamily: 'Inter Tight' },
  radii: { md: 16 },
  motion: {},
  logos: {},
  createdAt: '2026-05-09T00:00:00.000Z',
  updatedAt: '2026-05-09T00:00:00.000Z',
};

describe('api brand-kit repository', () => {
  beforeEach(() => {
    globalThis.localStorage.clear();
    localStorage.setItem('smx-studio-v4:brand-kit-api-base', BRAND_KIT_API_BASE);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('lists brand kits via GET', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ brandKits: [BRAND_KIT_FIXTURE] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const listed = await apiBrandKitRepository.list();
    expect(listed[0]?.id).toBe('kit_remote_1');
    expect(String(fetchMock.mock.calls[0][0])).toContain('/v1/brand-kits');
  });

  it('creates a brand kit via POST', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ brandKit: BRAND_KIT_FIXTURE }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const saved = await apiBrandKitRepository.save({ name: 'Remote Brand Kit', colors: { accent: '#ff6600' } });
    expect(saved.id).toBe('kit_remote_1');
    expect(fetchMock.mock.calls[0][1]?.method).toBe('POST');
  });
});
