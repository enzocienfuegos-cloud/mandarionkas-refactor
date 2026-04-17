import { afterEach, describe, expect, it } from 'vitest';
import { createInitialState } from '../../../domain/document/factories';
import { buildExportManifest, buildExportReadiness, buildStandaloneHtml, validateExport } from '../../../export/engine';
import { prepareExportStateWithResolvedAssets } from '../../../export/asset-resolution';
import { configureRepositoryServices, resetRepositoryServices } from '../../../repositories/services';
import type { AssetRecord } from '../../../assets/types';

describe('export engine', () => {
  afterEach(() => {
    resetRepositoryServices();
  });

  it('flags CTA widgets without open-url actions', () => {
    const state = createInitialState();
    const sceneId = state.document.scenes[0].id;
    state.document.widgets.cta_1 = {
      id: 'cta_1',
      type: 'cta',
      name: 'CTA',
      sceneId,
      zIndex: 1,
      frame: { x: 0, y: 0, width: 120, height: 40, rotation: 0 },
      style: {},
      props: { text: 'Buy now' },
      timeline: { startMs: 0, endMs: 1000 },
      actions: [],
    } as any;
    state.document.scenes[0].widgetIds.push('cta_1');

    const issues = validateExport(state);
    expect(issues.some((issue) => issue.scope === 'widget' && issue.message.includes('CTA'))).toBe(true);
  });

  it('builds readiness and manifest for target channel', () => {
    const state = createInitialState();
    state.document.name = 'Export Test';
    state.document.metadata.release.targetChannel = 'google-display';
    state.document.canvas.width = 300;
    state.document.canvas.height = 250;

    const readiness = buildExportReadiness(state);
    const manifest = buildExportManifest(state);

    expect(readiness.targetChannel).toBe('google-display');
    expect(readiness.checklist.length).toBeGreaterThan(0);
    expect(manifest.targetChannel).toBe('google-display');
    expect(manifest.documentName).toBe('Export Test');
  });



  it('renders plugin widgets like badge in standalone html', () => {
    const state = createInitialState();
    const sceneId = state.document.scenes[0].id;
    state.document.widgets.badge_1 = {
      id: 'badge_1',
      type: 'badge',
      name: 'Badge',
      sceneId,
      zIndex: 1,
      frame: { x: 0, y: 0, width: 180, height: 44, rotation: 0 },
      style: { backgroundColor: '#7c3aed', color: '#ffffff', borderRadius: 999 },
      props: { text: 'Limited drop', icon: '⚡' },
      timeline: { startMs: 0, endMs: 1000 },
    } as any;
    state.document.scenes[0].widgetIds.push('badge_1');

    const html = buildStandaloneHtml(state);
    expect(html).toContain('widget-badge');
    expect(html).toContain('Limited drop');
  });

  it('renders standalone html with manifest payload', () => {
    const state = createInitialState();
    state.document.name = 'Standalone';

    const html = buildStandaloneHtml(state);
    expect(html).toContain('<!doctype html>');
    expect(html).toContain('smx-export-manifest');
    expect(html).toContain('Standalone');
  });

  it('prepares asset-linked media widgets with channel-aware derivatives for export', async () => {
    const state = createInitialState();
    const sceneId = state.document.scenes[0].id;
    state.document.metadata.release.targetChannel = 'mraid';
    state.document.widgets.video_1 = {
      id: 'video_1',
      type: 'video-hero',
      name: 'Video',
      sceneId,
      zIndex: 1,
      frame: { x: 0, y: 0, width: 200, height: 120, rotation: 0 },
      style: {},
      props: {
        src: 'https://cdn.example.com/master.mp4',
        posterSrc: '',
        assetId: 'asset_video_1',
        assetQualityPreference: 'auto',
        autoplay: true,
        muted: true,
        loop: true,
        controls: false,
      },
      timeline: { startMs: 0, endMs: 1000 },
    } as any;
    state.document.scenes[0].widgetIds.push('video_1');

    const linkedVideo: AssetRecord = {
      id: 'asset_video_1',
      name: 'Demo video',
      kind: 'video',
      src: 'https://cdn.example.com/master.mp4',
      publicUrl: 'https://cdn.example.com/master.mp4',
      storageMode: 'object-storage',
      qualityPreference: 'auto',
      derivatives: {
        low: { src: 'https://cdn.example.com/demo-low.mp4', bitrateKbps: 900 },
        mid: { src: 'https://cdn.example.com/demo-mid.mp4', bitrateKbps: 1500 },
        high: { src: 'https://cdn.example.com/demo-high.mp4', bitrateKbps: 2500 },
        poster: { src: 'https://cdn.example.com/demo-poster.jpg' },
      },
      posterSrc: 'https://cdn.example.com/demo-poster.jpg',
      createdAt: '2026-04-18T00:00:00.000Z',
      clientId: 'client_default',
      ownerUserId: 'anonymous',
    };

    configureRepositoryServices(() => ({
      assets: {
        mode: 'local',
        list: async () => [linkedVideo],
        save: async () => linkedVideo,
        remove: async () => undefined,
        rename: async () => undefined,
        move: async () => undefined,
        updateQuality: async () => undefined,
        get: async (assetId?: string) => (assetId === linkedVideo.id ? linkedVideo : undefined),
        listFolders: async () => [],
        createFolder: async () => { throw new Error('not implemented'); },
        renameFolder: async () => undefined,
        deleteFolder: async () => undefined,
      },
      documents: {
        mode: 'local',
        saveAutosave: async () => undefined,
        saveManual: async () => undefined,
        loadAutosave: async () => null,
        loadManual: async () => null,
        clearAutosave: async () => undefined,
        clearManual: async () => undefined,
        hasAutosave: async () => false,
        hasManual: async () => false,
      },
      projects: {
        mode: 'local',
        list: async () => [],
        save: async () => ({ id: 'project_1', name: 'Test', updatedAt: '', clientId: 'client_default', ownerUserId: 'anonymous' }),
        load: async () => null,
        delete: async () => undefined,
        duplicate: async () => ({ id: 'project_1_copy', name: 'Test copy', updatedAt: '', clientId: 'client_default', ownerUserId: 'anonymous' }),
        archive: async () => undefined,
        restore: async () => undefined,
        changeOwner: async () => undefined,
      },
      projectVersions: {
        mode: 'local',
        list: async () => [],
        save: async () => ({ id: 'version_1', projectId: 'project_1', projectName: 'Test', versionNumber: 1, savedAt: '' }),
        load: async () => null,
      },
    }));

    const preparedState = await prepareExportStateWithResolvedAssets(state);
    expect(preparedState.document.widgets.video_1.props.src).toBe('https://cdn.example.com/demo-low.mp4');
    expect(preparedState.document.widgets.video_1.props.posterSrc).toBe('https://cdn.example.com/demo-poster.jpg');
  });

  it('prepares image-carousel slides from linked assets for export', async () => {
    const state = createInitialState();
    const sceneId = state.document.scenes[0].id;
    state.document.metadata.release.targetChannel = 'mraid';
    state.document.widgets.carousel_1 = {
      id: 'carousel_1',
      type: 'image-carousel',
      name: 'Carousel',
      sceneId,
      zIndex: 1,
      frame: { x: 0, y: 0, width: 220, height: 140, rotation: 0 },
      style: {},
      props: {
        title: 'Carousel',
        slides: JSON.stringify([
          { assetId: 'asset_image_1', caption: 'Hero frame' },
          { src: 'https://cdn.example.com/static.jpg', caption: 'Static frame' },
        ]),
        autoplay: true,
        intervalMs: 2500,
      },
      timeline: { startMs: 0, endMs: 1000 },
    } as any;
    state.document.scenes[0].widgetIds.push('carousel_1');

    const linkedImage: AssetRecord = {
      id: 'asset_image_1',
      name: 'Hero image',
      kind: 'image',
      src: 'https://cdn.example.com/hero-original.jpg',
      publicUrl: 'https://cdn.example.com/hero-original.jpg',
      storageMode: 'object-storage',
      qualityPreference: 'auto',
      derivatives: {
        low: { src: 'https://cdn.example.com/hero-low.webp', sizeBytes: 48000 },
        mid: { src: 'https://cdn.example.com/hero-mid.webp', sizeBytes: 92000 },
      },
      createdAt: '2026-04-18T00:00:00.000Z',
      clientId: 'client_default',
      ownerUserId: 'anonymous',
    };

    configureRepositoryServices(() => ({
      assets: {
        mode: 'local',
        list: async () => [linkedImage],
        save: async () => linkedImage,
        remove: async () => undefined,
        rename: async () => undefined,
        move: async () => undefined,
        updateQuality: async () => undefined,
        get: async (assetId?: string) => (assetId === linkedImage.id ? linkedImage : undefined),
        listFolders: async () => [],
        createFolder: async () => { throw new Error('not implemented'); },
        renameFolder: async () => undefined,
        deleteFolder: async () => undefined,
      },
      documents: {
        mode: 'local',
        saveAutosave: async () => undefined,
        saveManual: async () => undefined,
        loadAutosave: async () => null,
        loadManual: async () => null,
        clearAutosave: async () => undefined,
        clearManual: async () => undefined,
        hasAutosave: async () => false,
        hasManual: async () => false,
      },
      projects: {
        mode: 'local',
        list: async () => [],
        save: async () => ({ id: 'project_1', name: 'Test', updatedAt: '', clientId: 'client_default', ownerUserId: 'anonymous' }),
        load: async () => null,
        delete: async () => undefined,
        duplicate: async () => ({ id: 'project_1_copy', name: 'Test copy', updatedAt: '', clientId: 'client_default', ownerUserId: 'anonymous' }),
        archive: async () => undefined,
        restore: async () => undefined,
        changeOwner: async () => undefined,
      },
      projectVersions: {
        mode: 'local',
        list: async () => [],
        save: async () => ({ id: 'version_1', projectId: 'project_1', projectName: 'Test', versionNumber: 1, savedAt: '' }),
        load: async () => null,
      },
    }));

    const preparedState = await prepareExportStateWithResolvedAssets(state);
    expect(String(preparedState.document.widgets.carousel_1.props.slides)).toContain('https://cdn.example.com/hero-low.webp|Hero frame');
    expect(String(preparedState.document.widgets.carousel_1.props.slides)).toContain('https://cdn.example.com/static.jpg|Static frame');
  });

  it('prepares interactive-gallery items from linked assets for export', async () => {
    const state = createInitialState();
    const sceneId = state.document.scenes[0].id;
    state.document.metadata.release.targetChannel = 'mraid';
    state.document.widgets.gallery_1 = {
      id: 'gallery_1',
      type: 'interactive-gallery',
      name: 'Gallery',
      sceneId,
      zIndex: 1,
      frame: { x: 0, y: 0, width: 220, height: 140, rotation: 0 },
      style: {},
      props: {
        title: 'Gallery',
        itemCount: 1,
        activeIndex: 1,
        items: JSON.stringify([
          { assetId: 'asset_image_gallery_1', title: 'Gallery hero', subtitle: 'First card' },
        ]),
      },
      timeline: { startMs: 0, endMs: 1000 },
    } as any;
    state.document.scenes[0].widgetIds.push('gallery_1');

    const linkedImage: AssetRecord = {
      id: 'asset_image_gallery_1',
      name: 'Gallery image',
      kind: 'image',
      src: 'https://cdn.example.com/gallery-original.jpg',
      publicUrl: 'https://cdn.example.com/gallery-original.jpg',
      storageMode: 'object-storage',
      qualityPreference: 'auto',
      derivatives: {
        low: { src: 'https://cdn.example.com/gallery-low.webp', sizeBytes: 42000 },
        mid: { src: 'https://cdn.example.com/gallery-mid.webp', sizeBytes: 90000 },
      },
      createdAt: '2026-04-18T00:00:00.000Z',
      clientId: 'client_default',
      ownerUserId: 'anonymous',
    };

    configureRepositoryServices(() => ({
      assets: {
        mode: 'local',
        list: async () => [linkedImage],
        save: async () => linkedImage,
        remove: async () => undefined,
        rename: async () => undefined,
        move: async () => undefined,
        updateQuality: async () => undefined,
        get: async (assetId?: string) => (assetId === linkedImage.id ? linkedImage : undefined),
        listFolders: async () => [],
        createFolder: async () => { throw new Error('not implemented'); },
        renameFolder: async () => undefined,
        deleteFolder: async () => undefined,
      },
      documents: {
        mode: 'local',
        saveAutosave: async () => undefined,
        saveManual: async () => undefined,
        loadAutosave: async () => null,
        loadManual: async () => null,
        clearAutosave: async () => undefined,
        clearManual: async () => undefined,
        hasAutosave: async () => false,
        hasManual: async () => false,
      },
      projects: {
        mode: 'local',
        list: async () => [],
        save: async () => ({ id: 'project_1', name: 'Test', updatedAt: '', clientId: 'client_default', ownerUserId: 'anonymous' }),
        load: async () => null,
        delete: async () => undefined,
        duplicate: async () => ({ id: 'project_1_copy', name: 'Test copy', updatedAt: '', clientId: 'client_default', ownerUserId: 'anonymous' }),
        archive: async () => undefined,
        restore: async () => undefined,
        changeOwner: async () => undefined,
      },
      projectVersions: {
        mode: 'local',
        list: async () => [],
        save: async () => ({ id: 'version_1', projectId: 'project_1', projectName: 'Test', versionNumber: 1, savedAt: '' }),
        load: async () => null,
      },
    }));

    const preparedState = await prepareExportStateWithResolvedAssets(state);
    expect(String(preparedState.document.widgets.gallery_1.props.items)).toContain('https://cdn.example.com/gallery-low.webp');
    expect(String(preparedState.document.widgets.gallery_1.props.items)).toContain('Gallery hero');
  });
});
