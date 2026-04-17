import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { browserStorageAssetRepository } from '../../fakes/browser-storage-asset-repository';
import { configureRepositoryContextResolver, resetRepositoryContextResolver } from '../../../repositories/context';

describe('browser storage asset repository', () => {
  beforeEach(() => {
    globalThis.localStorage.clear();
    configureRepositoryContextResolver(() => ({
      clientId: 'client_default',
      ownerUserId: 'user_admin',
      can(permission: string) {
        return ['assets:create', 'assets:view-client', 'assets:update', 'assets:delete', 'assets:manage-client'].includes(permission);
      },
    }));
  });

  afterEach(() => {
    resetRepositoryContextResolver();
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

  it('supports folder CRUD and moving assets between folders', async () => {
    const folder = await browserStorageAssetRepository.createFolder('Campaign assets');
    expect((await browserStorageAssetRepository.listFolders())[0]?.name).toBe('Campaign assets');

    const asset = await browserStorageAssetRepository.save({
      name: 'Hero',
      kind: 'image',
      src: 'https://example.com/hero.png',
      publicUrl: 'https://example.com/hero.png',
      sourceType: 'url',
      storageMode: 'remote-url',
      accessScope: 'client',
    });

    await browserStorageAssetRepository.move(asset.id, folder.id);
    expect((await browserStorageAssetRepository.get(asset.id))?.folderId).toBe(folder.id);

    await browserStorageAssetRepository.renameFolder(folder.id, 'Campaign assets v2');
    expect((await browserStorageAssetRepository.listFolders())[0]?.name).toBe('Campaign assets v2');

    await browserStorageAssetRepository.deleteFolder(folder.id);
    expect(await browserStorageAssetRepository.listFolders()).toHaveLength(0);
    expect((await browserStorageAssetRepository.get(asset.id))?.folderId).toBeUndefined();
  });

  it('persists asset quality preference changes', async () => {
    const asset = await browserStorageAssetRepository.save({
      name: 'Quality Hero',
      kind: 'image',
      src: 'https://example.com/hero.png',
      publicUrl: 'https://example.com/hero.png',
      sourceType: 'url',
      storageMode: 'remote-url',
      accessScope: 'client',
    });

    await browserStorageAssetRepository.updateQuality(asset.id, 'low');
    expect((await browserStorageAssetRepository.get(asset.id))?.qualityPreference).toBe('low');
  });

  it('prefers optimized asset URLs when available', async () => {
    const asset = await browserStorageAssetRepository.save({
      name: 'Optimized hero',
      kind: 'image',
      src: 'https://example.com/original.jpg',
      publicUrl: 'https://example.com/original.jpg',
      optimizedUrl: 'https://example.com/optimized.webp',
      sourceType: 'url',
      storageMode: 'remote-url',
      accessScope: 'client',
    });

    expect(asset.src).toBe('https://example.com/optimized.webp');
    expect(asset.optimizedUrl).toBe('https://example.com/optimized.webp');
  });
});
