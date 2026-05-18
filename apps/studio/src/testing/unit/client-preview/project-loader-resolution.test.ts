// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createInitialState } from '../../../domain/document/factories';
import { prepareClientPreviewProjectState } from '../../../features/client-preview/project-loader';
import { configureRepositoryServices, resetRepositoryServices } from '../../../repositories/services';

const getAssetMock = vi.fn();

describe('client preview project loader asset preparation', () => {
  afterEach(() => {
    vi.clearAllMocks();
    resetRepositoryServices();
  });

  it('prepares resolved asset URLs before building the public preview iframe state', async () => {
    const state = createInitialState();
    state.document.widgets.image_1 = {
      id: 'image_1',
      type: 'image',
      name: 'Hero',
      sceneId: state.document.scenes[0].id,
      zIndex: 1,
      frame: { x: 0, y: 0, width: 120, height: 80, rotation: 0 },
      style: {},
      props: { assetId: 'asset_hero', src: 'blob:hero-preview' },
      timeline: { startMs: 0, endMs: 1000, keyframes: [] },
    } as any;
    state.document.scenes[0].widgetIds.push('image_1');

    getAssetMock.mockResolvedValue({
      id: 'asset_hero',
      name: 'Hero',
      kind: 'image',
      src: 'https://cdn.example.com/hero-mid.jpg',
      publicUrl: 'https://cdn.example.com/hero-mid.jpg',
      optimizedUrl: 'https://cdn.example.com/hero-mid.jpg',
      createdAt: '2026-05-17T00:00:00.000Z',
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

    const prepared = await prepareClientPreviewProjectState(state);

    expect(getAssetMock).toHaveBeenCalledWith('asset_hero');
    expect(prepared.document.widgets.image_1?.props.src).toBe('https://cdn.example.com/hero-mid.jpg');
  });
});
