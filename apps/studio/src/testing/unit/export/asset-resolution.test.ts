import { afterEach, describe, expect, it, vi } from 'vitest';
import { createInitialState } from '../../../domain/document/factories';
import { prepareExportStateWithResolvedAssets } from '../../../export/asset-resolution';
import { configureRepositoryServices, resetRepositoryServices } from '../../../repositories/services';

const getAssetMock = vi.fn();

describe('asset resolution', () => {
  afterEach(() => {
    getAssetMock.mockReset();
    resetRepositoryServices();
  });

  it('resolves public-preview asset URLs for direct widgets, bound props, and shoppable products', async () => {
    const state = createInitialState();
    const sceneId = state.document.scenes[0].id;
    state.document.metadata.release.targetChannel = 'generic-html5';
    state.document.widgets.hero_1 = {
      id: 'hero_1',
      type: 'image',
      name: 'Hero',
      sceneId,
      zIndex: 1,
      frame: { x: 0, y: 0, width: 120, height: 80, rotation: 0 },
      style: {},
      props: { assetId: 'asset_hero', src: 'blob:hero-preview', alt: 'Hero' },
      timeline: { startMs: 0, endMs: 1000, keyframes: [] },
    } as any;
    state.document.widgets.dynamic_map = {
      id: 'dynamic_map',
      type: 'dynamic-map',
      name: 'Map',
      sceneId,
      zIndex: 2,
      frame: { x: 0, y: 90, width: 200, height: 120, rotation: 0 },
      style: {},
      props: {
        heroImageAssetId: 'asset_map_hero',
        heroImage: 'blob:map-hero',
        logoImageAssetId: 'asset_map_logo',
        logoImage: 'blob:map-logo',
      },
      timeline: { startMs: 0, endMs: 1000, keyframes: [] },
    } as any;
    state.document.widgets.scratch_1 = {
      id: 'scratch_1',
      type: 'scratch-reveal',
      name: 'Scratch',
      sceneId,
      zIndex: 3,
      frame: { x: 0, y: 220, width: 200, height: 100, rotation: 0 },
      style: {},
      props: {
        beforeAssetId: 'asset_before',
        beforeImage: 'blob:before',
        afterAssetId: 'asset_after',
        afterImage: 'blob:after',
      },
      timeline: { startMs: 0, endMs: 1000, keyframes: [] },
    } as any;
    state.document.widgets.shop_1 = {
      id: 'shop_1',
      type: 'shoppable-sidebar',
      name: 'Shop',
      sceneId,
      zIndex: 4,
      frame: { x: 0, y: 330, width: 220, height: 140, rotation: 0 },
      style: {},
      props: {
        products: 'blob:shop-1|Product 1|Featured|$9|4|Buy|https://example.com|asset_shop_1',
      },
      timeline: { startMs: 0, endMs: 1000, keyframes: [] },
    } as any;
    state.document.scenes[0].widgetIds.push('hero_1', 'dynamic_map', 'scratch_1', 'shop_1');

    getAssetMock.mockImplementation(async (assetId?: string) => {
      const srcById: Record<string, string> = {
        asset_hero: 'https://cdn.example.com/hero-mid.jpg',
        asset_map_hero: 'https://cdn.example.com/map-hero-mid.jpg',
        asset_map_logo: 'https://cdn.example.com/map-logo-mid.png',
        asset_before: 'https://cdn.example.com/before-mid.jpg',
        asset_after: 'https://cdn.example.com/after-mid.jpg',
        asset_shop_1: 'https://cdn.example.com/shop-1-mid.jpg',
      };
      if (!assetId || !(assetId in srcById)) return undefined;
      return {
        id: assetId,
        name: assetId,
        kind: 'image',
        src: srcById[assetId],
        publicUrl: srcById[assetId],
        optimizedUrl: srcById[assetId],
        createdAt: '2026-05-17T00:00:00.000Z',
      };
    });
    configureRepositoryServices(() => ({
      assets: {
        list: async () => [],
        save: async () => { throw new Error('not implemented'); },
        remove: async () => {},
        rename: async () => {},
        move: async () => {},
        updateQuality: async () => {},
        reprocess: async () => undefined,
        get: getAssetMock,
        listFolders: async () => [],
        createFolder: async () => ({ id: 'folder_1', name: 'Folder', createdAt: '2026-05-17T00:00:00.000Z' }),
        renameFolder: async () => undefined,
        deleteFolder: async () => {},
      },
      brandKits: {
        list: async () => [],
        get: async () => undefined,
        save: async () => { throw new Error('not implemented'); },
        delete: async () => {},
      },
      documents: {
        saveAutosave: async () => {},
        saveManual: async () => {},
        loadAutosave: async () => null,
        loadManual: async () => null,
        clearAutosave: async () => {},
        clearManual: async () => {},
        hasAutosave: async () => false,
        hasManual: async () => false,
      },
      projects: {
        list: async () => [],
        save: async () => { throw new Error('not implemented'); },
        load: async () => null,
        delete: async () => {},
        duplicate: async () => { throw new Error('not implemented'); },
        archive: async () => {},
        restore: async () => {},
        changeOwner: async () => {},
      },
      projectVersions: {
        list: async () => [],
        save: async () => { throw new Error('not implemented'); },
        load: async () => null,
      },
    }));

    const prepared = await prepareExportStateWithResolvedAssets(state);

    expect(prepared.document.widgets.hero_1?.props.src).toBe('https://cdn.example.com/hero-mid.jpg');
    expect(prepared.document.widgets.dynamic_map?.props.heroImage).toBe('https://cdn.example.com/map-hero-mid.jpg');
    expect(prepared.document.widgets.dynamic_map?.props.logoImage).toBe('https://cdn.example.com/map-logo-mid.png');
    expect(prepared.document.widgets.scratch_1?.props.beforeImage).toBe('https://cdn.example.com/before-mid.jpg');
    expect(prepared.document.widgets.scratch_1?.props.afterImage).toBe('https://cdn.example.com/after-mid.jpg');
    expect(String(prepared.document.widgets.shop_1?.props.products ?? '')).toContain('https://cdn.example.com/shop-1-mid.jpg');
  });
});
