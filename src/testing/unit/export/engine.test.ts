import { describe, expect, it } from 'vitest';
import { createInitialState } from '../../../domain/document/factories';
import {
  buildExportManifest,
  buildExportModel,
  buildExportReadiness,
  buildPackageBundle,
  buildStandaloneHtml,
  validateExport,
} from '../../../export/engine';
import { createDegradedExportMediaFixture } from '../../fixtures/degraded-export-media';
import { createMixedExportStoryFixture } from '../../fixtures/mixed-export-story';

describe('export engine', () => {
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
    expect(readiness.assetSummary.bundledCount).toBeGreaterThanOrEqual(0);
    expect(manifest.bundledAssetCount).toBeGreaterThanOrEqual(0);
  });

  it('surfaces external asset references in readiness and manifest', () => {
    const state = createInitialState();
    const sceneId = state.document.scenes[0].id;
    state.document.widgets.image_1 = {
      id: 'image_1',
      type: 'image',
      name: 'Image',
      sceneId,
      zIndex: 1,
      frame: { x: 0, y: 0, width: 120, height: 80, rotation: 0 },
      style: {},
      props: { src: 'https://cdn.example.com/banner.jpg', alt: 'Remote image' },
      timeline: { startMs: 0, endMs: 1000 },
    } as any;
    state.document.scenes[0].widgetIds.push('image_1');

    const readiness = buildExportReadiness(state);
    const manifest = buildExportManifest(state);

    expect(readiness.assetSummary.externalReferenceCount).toBe(1);
    expect(manifest.externalAssetCount).toBe(1);
    expect(readiness.checklist.some((item) => item.label.includes('external references') && !item.passed)).toBe(true);
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

  it('builds a mixed export model with scenes, actions, assets, and target coverage', () => {
    const state = createMixedExportStoryFixture();

    const exportModel = buildExportModel(state);
    const manifest = buildExportManifest(state);
    const readiness = buildExportReadiness(state);

    expect(exportModel.scenes).toHaveLength(2);
    expect(exportModel.initialSceneId).toBe('scene_intro');
    expect(exportModel.exits.some((exit) => exit.sourceWidgetId === 'offer_buttons' && exit.targetKey === 'primary-button')).toBe(true);
    expect(exportModel.sceneActions.some((action) => action.sourceWidgetId === 'offer_buttons' && action.targetSceneId === 'scene_details')).toBe(true);
    expect(exportModel.widgetActions.some((action) => action.sourceWidgetId === 'product_hotspot' && action.actionType === 'toggle-widget')).toBe(true);
    expect(exportModel.widgetActions.some((action) => action.sourceWidgetId === 'details_copy' && action.trigger === 'timeline-enter' && action.atMs === 600)).toBe(true);
    expect(exportModel.textActions.some((action) => action.sourceWidgetId === 'details_cta' && action.targetWidgetId === 'details_copy')).toBe(true);
    expect(exportModel.assetSummary.externalReferenceCount).toBe(1);
    expect(exportModel.assetSummary.bundledCount).toBeGreaterThanOrEqual(1);
    expect(exportModel.targetCoverage.find((item) => item.widgetId === 'offer_buttons')?.coverage).toBe('partial');
    expect(exportModel.targetCoverage.find((item) => item.widgetId === 'product_hotspot')?.coverage).toBe('none');
    expect(manifest.partiallyCoveredTargetCount).toBe(1);
    expect(manifest.degradedWidgetCount).toBe(0);
    expect(manifest.blockedWidgetCount).toBe(0);
    expect(readiness.targetCoverage.find((item) => item.widgetId === 'product_hotspot')?.missingTargets).toContain('hotspot-card');
  });

  it('builds a mixed export package bundle with manifest, runtime, asset map, and bundled assets', () => {
    const state = createMixedExportStoryFixture();
    const bundle = buildPackageBundle(state, { qualityProfile: 'high' });
    const filePaths = bundle.files.map((file) => file.path);

    expect(bundle.entry).toBe('index.html');
    expect(filePaths).toEqual(expect.arrayContaining([
      'index.html',
      'styles.css',
      'runtime.js',
      'manifest.json',
      'asset-map.json',
    ]));
    expect(filePaths.some((path) => path.startsWith('assets/') && path.endsWith('.svg'))).toBe(true);

    const indexHtml = bundle.files.find((file) => file.path === 'index.html')?.content ?? '';
    const runtimeJs = bundle.files.find((file) => file.path === 'runtime.js')?.content ?? '';
    const manifestJson = bundle.files.find((file) => file.path === 'manifest.json')?.content ?? '{}';
    const assetMapJson = bundle.files.find((file) => file.path === 'asset-map.json')?.content ?? '[]';

    const manifest = JSON.parse(manifestJson);
    const assetMap = JSON.parse(assetMapJson);

    expect(indexHtml).toContain('smx-export-model');
    expect(indexHtml).toContain('./assets/details_qr-svg.svg');
    expect(indexHtml).toContain('Quality high');
    expect(runtimeJs).toContain('setActiveScene');
    expect(runtimeJs).toContain('timeline-enter');
    expect(runtimeJs).toContain('widget-degradation-marker');
    expect(manifest.qualityProfile).toBe('high');
    expect(manifest.exportModel.qualityProfile).toBe('high');
    expect(manifest.exportModel.sceneActions).toHaveLength(1);
    expect(manifest.exportModel.widgetActions.length).toBeGreaterThanOrEqual(2);
    expect(manifest.exportModel.textActions).toHaveLength(1);
    expect(assetMap.some((asset: { widgetId: string; packaging: string }) => asset.widgetId === 'hero_image' && asset.packaging === 'external-reference')).toBe(true);
    expect(assetMap.some((asset: { widgetId: string; packagePath: string; packaging: string; qualityProfile: string; qualityHint: string }) => asset.widgetId === 'details_qr' && asset.packagePath === 'assets/details_qr-svg.svg' && asset.packaging === 'bundled' && asset.qualityProfile === 'high' && asset.qualityHint === 'source')).toBe(true);
  });

  it('marks degraded media modules honestly while still exporting usable fallbacks', () => {
    const state = createDegradedExportMediaFixture();

    const readiness = buildExportReadiness(state);
    const manifest = buildExportManifest(state);
    const html = buildStandaloneHtml(state);
    const bundle = buildPackageBundle(state);
    const assetMapJson = bundle.files.find((file) => file.path === 'asset-map.json')?.content ?? '[]';
    const assetMap = JSON.parse(assetMapJson);

    expect(readiness.capabilitySummary.degraded.map((item) => item.widgetType).sort()).toEqual(['image-carousel', 'video-hero']);
    expect(readiness.degradedWidgets.every((item) => Boolean(item.degradationStrategy))).toBe(true);
    expect(readiness.highestRequiredTier).toBe('advanced-interactive');
    expect(readiness.checklist.some((item) => item.label.includes('Selected interaction tier supports this creative') && !item.passed)).toBe(true);
    expect(readiness.checklist.some((item) => item.label.includes('fallback strategies') && item.passed)).toBe(true);
    expect(manifest.exportModel.nodes.find((node) => node.widgetId === 'video_story')?.capabilityStatus).toBe('degraded');
    expect(manifest.exportModel.nodes.find((node) => node.widgetId === 'carousel_story')?.capabilityStatus).toBe('degraded');
    expect(manifest.exportModel.nodes.find((node) => node.widgetId === 'video_story')?.degradationStrategy).toBe('poster-fallback');
    expect(manifest.exportModel.nodes.find((node) => node.widgetId === 'carousel_story')?.degradationStrategy).toBe('first-state');
    expect(manifest.degradedWidgetCount).toBe(2);
    expect(manifest.blockedWidgetCount).toBe(0);
    expect(manifest.degradedWidgets.find((item) => item.widgetId === 'video_story')?.degradationStrategy).toBe('poster-fallback');
    expect(manifest.degradedWidgets.find((item) => item.widgetId === 'carousel_story')?.degradationStrategy).toBe('first-state');
    expect(manifest.assetCount).toBe(5);
    expect(manifest.bundledAssetCount).toBe(1);
    expect(manifest.externalAssetCount).toBe(4);
    expect(html).toContain('Video fallback');
    expect(html).toContain('first-state export');
    expect(bundle.files.find((file) => file.path === 'runtime.js')?.content).toContain('data-widget-degradation-id');
    expect(assetMap.some((asset: { widgetId: string; kind: string; packaging: string }) => asset.widgetId === 'video_story' && asset.kind === 'poster' && asset.packaging === 'bundled')).toBe(true);
    expect(assetMap.filter((asset: { widgetId: string }) => asset.widgetId === 'carousel_story')).toHaveLength(3);
  });

  it('propagates quality profiles through model, manifest, readiness, and package assets', () => {
    const state = createDegradedExportMediaFixture();

    const exportModel = buildExportModel(state, { qualityProfile: 'low' });
    const manifest = buildExportManifest(state, { qualityProfile: 'low' });
    const readiness = buildExportReadiness(state, { qualityProfile: 'low' });
    const bundle = buildPackageBundle(state, { qualityProfile: 'low' });
    const assetMapJson = bundle.files.find((file) => file.path === 'asset-map.json')?.content ?? '[]';
    const assetMap = JSON.parse(assetMapJson);

    expect(exportModel.qualityProfile).toBe('low');
    expect(manifest.qualityProfile).toBe('low');
    expect(readiness.qualityProfile).toBe('low');
    expect(exportModel.assets.find((asset) => asset.widgetId === 'video_story' && asset.kind === 'video')?.qualityHint).toBe('low');
    expect(exportModel.assets.find((asset) => asset.widgetId === 'video_story' && asset.kind === 'poster')?.qualityHint).toBe('low');
    expect(exportModel.assets.find((asset) => asset.widgetId === 'carousel_story' && asset.kind === 'image')?.qualityHint).toBe('low');
    expect(assetMap.every((asset: { qualityProfile: string }) => asset.qualityProfile === 'low')).toBe(true);
    expect(bundle.files.find((file) => file.path === 'index.html')?.content).toContain('Quality low');
  });

  it('selects different linked asset sources when original and public urls are both available', () => {
    const state = createInitialState({ name: 'Linked Asset Quality' });
    const sceneId = state.document.scenes[0].id;
    state.document.widgets.hero_image = {
      id: 'hero_image',
      type: 'image',
      name: 'Hero Image',
      sceneId,
      zIndex: 1,
      frame: { x: 0, y: 0, width: 180, height: 120, rotation: 0 },
      style: {},
      props: {
        assetId: 'asset_local_hero',
        src: 'https://fallback.example.com/original.jpg',
        alt: 'Linked hero',
      },
      timeline: { startMs: 0, endMs: 1000 },
    } as any;
    state.document.scenes[0].widgetIds.push('hero_image');

    const linkedAssets = [{
      id: 'asset_local_hero',
      src: '',
      publicUrl: 'https://cdn.example.com/hero-optimized.jpg',
      originUrl: 'https://cdn.example.com/hero-original.jpg',
      storageMode: 'object-storage',
      storageKey: 'assets/hero-original',
      mimeType: 'image/jpeg',
    }];

    const highModel = buildExportModel(state, { qualityProfile: 'high', linkedAssets });
    const lowModel = buildExportModel(state, { qualityProfile: 'low', linkedAssets });

    expect(highModel.assets.find((asset) => asset.widgetId === 'hero_image')?.src).toBe('https://cdn.example.com/hero-original.jpg');
    expect(lowModel.assets.find((asset) => asset.widgetId === 'hero_image')?.src).toBe('https://cdn.example.com/hero-optimized.jpg');
    expect(highModel.assets.find((asset) => asset.widgetId === 'hero_image')?.packaging).toBe('external-reference');
    expect(lowModel.assets.find((asset) => asset.widgetId === 'hero_image')?.packaging).toBe('external-reference');
  });
});
