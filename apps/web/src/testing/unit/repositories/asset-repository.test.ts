import { beforeEach, describe, expect, it } from 'vitest';
import { platformStore } from '../../../platform/store';
import { localAssetRepository } from '../../../repositories/asset/local';

describe('local asset repository', () => {
  beforeEach(() => {
    globalThis.localStorage.clear();
    platformStore.login('admin@smx.studio', 'demo123');
  });

  it('saves, renames and removes assets', async () => {
    const asset = await localAssetRepository.save({
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

    const listed = await localAssetRepository.list();
    expect(listed.some((item) => item.id === asset.id)).toBe(true);

    await localAssetRepository.rename(asset.id, 'Hero Updated');
    const loaded = await localAssetRepository.get(asset.id);
    expect(loaded?.name).toBe('Hero Updated');

    await localAssetRepository.remove(asset.id);
    const afterRemove = await localAssetRepository.get(asset.id);
    expect(afterRemove).toBeUndefined();
  });

  it('stores uploaded payloads outside the asset record while deduplicating fingerprints', async () => {
    const first = await localAssetRepository.save({
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

    const duplicate = await localAssetRepository.save({
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
    expect(await localAssetRepository.list()).toHaveLength(1);

    const persistedAssets = JSON.parse(localStorage.getItem('smx-studio-v4:asset-library') ?? '[]') as Array<Record<string, unknown>>;
    expect(String(persistedAssets[0]?.src ?? '')).toBe('');
    expect(localStorage.getItem('smx-studio-v4:asset-object-store')).toContain('data:image/png;base64,AAA');
  });
});
