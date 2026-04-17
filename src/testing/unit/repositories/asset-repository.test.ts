import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { platformStore } from '../../../platform/store';
import { browserStorageAssetRepository } from '../../fakes/browser-storage-asset-repository';

describe('browser storage asset repository', () => {
  const fetchMock = vi.fn();

  beforeEach(async () => {
    globalThis.localStorage.clear();
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
      permissions: ['assets:create', 'assets:view-client', 'assets:update', 'assets:delete', 'assets:manage-client'],
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

  it('saves, renames and removes assets', async () => {
    const asset = await browserStorageAssetRepository.save({
      name: 'Hero',
      kind: 'image',
      src: 'https://example.com/hero.png',
      publicUrl: 'https://example.com/hero.png',
      originUrl: 'https://example.com/hero.png',
      sourceType: 'url',
      storageMode: 'remote-url',
      fingerprint: 'hero-remote',
      accessScope: 'private',
    });

    const listed = await browserStorageAssetRepository.list();
    expect(listed.some((item) => item.id === asset.id)).toBe(true);

    await browserStorageAssetRepository.rename(asset.id, 'Hero Updated');
    const loaded = await browserStorageAssetRepository.get(asset.id);
    expect(loaded?.name).toBe('Hero Updated');

    await browserStorageAssetRepository.remove(asset.id);
    const afterRemove = await browserStorageAssetRepository.get(asset.id);
    expect(afterRemove).toBeUndefined();
  });

  it('stores uploaded payloads outside the asset record while deduplicating fingerprints', async () => {
    const first = await browserStorageAssetRepository.save({
      name: 'Poster A',
      kind: 'image',
      src: '',
      sourceType: 'upload',
      storageMode: 'object-storage',
      storageKey: 'demo/poster-a',
      storagePayload: 'data:image/png;base64,AAA',
      fingerprint: 'same-file',
      accessScope: 'client',
    });

    const duplicate = await browserStorageAssetRepository.save({
      name: 'Poster B',
      kind: 'image',
      src: '',
      sourceType: 'upload',
      storageMode: 'object-storage',
      storageKey: 'demo/poster-b',
      storagePayload: 'data:image/png;base64,BBB',
      fingerprint: 'same-file',
      accessScope: 'client',
    });

    expect(first.src).toContain('data:image/png');
    expect(duplicate.id).toBe(first.id);
    expect(await browserStorageAssetRepository.list()).toHaveLength(1);

    const persistedAssets = JSON.parse(localStorage.getItem('smx-studio-v4:asset-library') ?? '[]') as Array<Record<string, unknown>>;
    expect(String(persistedAssets[0]?.src ?? '')).toBe('');
    expect(localStorage.getItem('smx-studio-v4:asset-object-store')).toContain('data:image/png;base64,AAA');
  });
});
