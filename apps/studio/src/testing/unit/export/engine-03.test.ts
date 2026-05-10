import { describe, expect, it } from 'vitest';
import { createInitialState } from '../../../domain/document/factories';
import { buildChannelHtml, buildExportAssetPlan, buildExportBundle, buildExportBundleWithRemoteAssets, buildExportExitConfig, buildExportHandoff, buildExportManifest, buildExportPackagingPlan, buildExportPackageMetrics, buildExportPreflight, buildExportReadiness, buildExportRuntimeModel, buildExportRuntimeScript, buildExportSizeSetBundle, buildExportSizeSetBundleWithRemoteAssets, buildGamHtml5Adapter, buildGenericHtml5Adapter, buildGoogleDisplayAdapter, buildMraidAdapter, buildPlayableExportAdapter, buildPlayableSingleFileHtml, buildLocalizedPortableProject, buildPortableProjectExport, buildPublishPackage, buildRemoteAssetFetchPlan, buildReviewPackage, buildStandaloneHtml, buildVastSimidAdapter, buildVastSimidXml, buildZipFromBundle, getChannelRequirements, materializeExportAssetFiles, materializeRemoteExportAssetFiles, validateExport, validateExportPackage, validatePortableExport } from '../../../export/engine';
import { reduceBySlices } from '../../../core/store/reducers';
import { documentSceneReducer } from '../../../core/store/reducers/document-scene-reducer';
import { buildNearbyPlacesCsv, parseNearbyPlaces } from '../../../widgets/modules/dynamic-map.shared';

describe('export engine', () => {
  function buildMraidFixtureState(size: '320x480' | '300x600') {
    const state = createInitialState();
    const sceneId = state.document.scenes[0].id;
    const [width, height] = size.split('x').map(Number);
    state.document.metadata.release.targetChannel = 'mraid';
    state.document.metadata.release.qaStatus = 'ready-for-qa';
    state.document.name = `MRAID ${size}`;
    state.document.canvas.width = width;
    state.document.canvas.height = height;
    state.document.widgets.hero_1 = {
      id: 'hero_1',
      type: 'hero-image',
      name: 'Hero',
      sceneId,
      zIndex: 1,
      frame: { x: 0, y: 0, width, height: Math.max(160, Math.floor(height * 0.42)), rotation: 0 },
      style: {},
      props: { src: 'https://cdn.example.com/hero.jpg', alt: 'Hero' },
      timeline: { startMs: 0, endMs: 15000 },
    } as any;
    state.document.widgets.carousel_1 = {
      id: 'carousel_1',
      type: 'image-carousel',
      name: 'Carousel',
      sceneId,
      zIndex: 2,
      frame: { x: 12, y: Math.max(120, Math.floor(height * 0.46)), width: width - 24, height: Math.max(110, Math.floor(height * 0.26)), rotation: 0 },
      style: {},
      props: {
        slides: 'https://cdn.example.com/slide-a.jpg|;https://cdn.example.com/slide-b.jpg|',
        autoplay: false,
        showPrevButton: true,
        showNextButton: true,
      },
      timeline: { startMs: 0, endMs: 15000 },
    } as any;
    state.document.widgets.cta_1 = {
      id: 'cta_1',
      type: 'cta',
      name: 'CTA',
      sceneId,
      zIndex: 3,
      frame: { x: 20, y: height - 64, width: Math.max(120, width - 40), height: 44, rotation: 0 },
      style: {},
      props: { text: 'Open', url: 'https://example.com' },
      timeline: { startMs: 0, endMs: 15000 },
      actions: [],
    } as any;
    state.document.actions.act_1 = {
      id: 'act_1',
      widgetId: 'cta_1',
      trigger: 'click',
      type: 'open-url',
      url: 'https://example.com',
      label: 'Exit',
    };
    state.document.scenes[0].widgetIds.push('hero_1', 'carousel_1', 'cta_1');
    return state;
  }

  it('builds a packaging plan with clickTag exit strategy for gam html5', () => {
    const state = createInitialState();
    state.document.metadata.release.targetChannel = 'gam-html5';
    const gam = buildGamHtml5Adapter(state);

    const plan = buildExportPackagingPlan(gam);

    expect(plan.adapter).toBe('gam-html5');
    expect(plan.exitStrategy).toBe('clickTag');
    expect(plan.entryFile).toBe('index.html');
  });

  it('builds a packaging plan with mraid open strategy for mraid exports', () => {
    const state = createInitialState();
    state.document.canvas.width = 320;
    state.document.canvas.height = 480;
    state.document.metadata.release.targetChannel = 'mraid';
    const mraid = buildMraidAdapter(state);

    const plan = buildExportPackagingPlan(mraid);

    expect(plan.adapter).toBe('mraid');
    expect(plan.exitStrategy).toBe('mraid-open');
    expect(plan.entryFile).toBe('index.html');
  });

  it('builds an exit config with clickTag strategy for gam html5', () => {
    const state = createInitialState();
    const sceneId = state.document.scenes[0].id;
    state.document.metadata.release.targetChannel = 'gam-html5';
    state.document.widgets.cta_1 = {
      id: 'cta_1',
      type: 'cta',
      name: 'CTA',
      sceneId,
      zIndex: 1,
      frame: { x: 0, y: 0, width: 160, height: 44, rotation: 0 },
      style: {},
      props: { text: 'Tap now', url: 'https://example.com' },
      timeline: { startMs: 0, endMs: 1000 },
    } as any;
    state.document.actions.act_1 = {
      id: 'act_1',
      widgetId: 'cta_1',
      trigger: 'click',
      type: 'open-url',
      url: 'https://example.com',
      label: 'Exit',
    };
    state.document.scenes[0].widgetIds.push('cta_1');
    const gam = buildGamHtml5Adapter(state);

    const exitConfig = buildExportExitConfig(gam);

    expect(exitConfig.strategy).toBe('clickTag');
    expect(exitConfig.primaryUrl).toBe('https://example.com');
    expect(exitConfig.urls).toContain('https://example.com');
  });

  it('builds an exit config with mraid-open strategy for mraid', () => {
    const state = createInitialState();
    const sceneId = state.document.scenes[0].id;
    state.document.canvas.width = 320;
    state.document.canvas.height = 480;
    state.document.metadata.release.targetChannel = 'mraid';
    state.document.widgets.cta_1 = {
      id: 'cta_1',
      type: 'cta',
      name: 'CTA',
      sceneId,
      zIndex: 1,
      frame: { x: 0, y: 0, width: 160, height: 44, rotation: 0 },
      style: {},
      props: { text: 'Tap now', url: 'https://example.com' },
      timeline: { startMs: 0, endMs: 1000 },
    } as any;
    state.document.actions.act_1 = {
      id: 'act_1',
      widgetId: 'cta_1',
      trigger: 'click',
      type: 'open-url',
      url: 'https://example.com',
      label: 'Exit',
    };
    state.document.scenes[0].widgetIds.push('cta_1');
    const mraid = buildMraidAdapter(state);

    const exitConfig = buildExportExitConfig(mraid);

    expect(exitConfig.strategy).toBe('mraid-open');
    expect(exitConfig.primaryUrl).toBe('https://example.com');
  });

  it('collects asset plan entries for widget media and carousel slides', () => {
    const state = createInitialState();
    const sceneId = state.document.scenes[0].id;
    state.document.widgets.image_1 = {
      id: 'image_1',
      type: 'image',
      name: 'Image',
      sceneId,
      zIndex: 1,
      frame: { x: 0, y: 0, width: 120, height: 120, rotation: 0 },
      style: {},
      props: { src: 'https://cdn.example.com/hero.png' },
      timeline: { startMs: 0, endMs: 1000 },
    } as any;
    state.document.widgets.carousel_1 = {
      id: 'carousel_1',
      type: 'image-carousel',
      name: 'Carousel',
      sceneId,
      zIndex: 2,
      frame: { x: 0, y: 0, width: 240, height: 120, rotation: 0 },
      style: {},
      props: {
        slides: 'https://cdn.example.com/slide-a.png|Slide A;https://cdn.example.com/slide-b.jpg|Slide B',
      },
      timeline: { startMs: 0, endMs: 1000 },
    } as any;
    state.document.scenes[0].widgetIds.push('image_1', 'carousel_1');

    const plan = buildExportAssetPlan(buildPortableProjectExport(state));

    expect(plan).toHaveLength(3);
    expect(plan[0]?.packagingPath).toContain('assets/image/image_1/');
    expect(plan.some((entry) => entry.fileName.includes('slide-a'))).toBe(true);
    expect(plan.some((entry) => entry.fileName.includes('slide-b'))).toBe(true);
  });

  it('builds a localized portable project with asset paths rewritten to bundle paths', () => {
    const state = createInitialState();
    const sceneId = state.document.scenes[0].id;
    state.document.widgets.hero_1 = {
      id: 'hero_1',
      type: 'hero-image',
      name: 'Hero',
      sceneId,
      zIndex: 1,
      frame: { x: 0, y: 0, width: 320, height: 180, rotation: 0 },
      style: {},
      props: { src: 'https://cdn.example.com/hero.png' },
      timeline: { startMs: 0, endMs: 1000 },
    } as any;
    state.document.scenes[0].widgetIds.push('hero_1');

    const portable = buildPortableProjectExport(state);
    const assetPlan = buildExportAssetPlan(portable);
    const localized = buildLocalizedPortableProject(portable, assetPlan);

    expect(localized.assets[0]?.src).toBe('assets/image/hero_1/hero.png');
    expect(localized.scenes[0]?.widgets[0]?.props.src).toBe('assets/image/hero_1/hero.png');
  });

  it('rewrites inline data-uri asset paths to local bundle paths in localized exports', () => {
    const state = createInitialState();
    const sceneId = state.document.scenes[0].id;
    state.document.widgets.image_1 = {
      id: 'image_1',
      type: 'image',
      name: 'Image',
      sceneId,
      zIndex: 1,
      frame: { x: 0, y: 0, width: 120, height: 120, rotation: 0 },
      style: {},
      props: { src: 'data:text/plain;base64,SGVsbG8=' },
      timeline: { startMs: 0, endMs: 1000 },
    } as any;
    state.document.scenes[0].widgetIds.push('image_1');

    const portable = buildPortableProjectExport(state);
    const assetPlan = buildExportAssetPlan(portable);
    const localized = buildLocalizedPortableProject(portable, assetPlan);

    expect(localized.assets[0]?.src).toContain('assets/image/image_1/');
    expect(localized.scenes[0]?.widgets[0]?.props.src).toContain('assets/image/image_1/');
  });

  it('builds a remote fetch plan for bundled remote assets', () => {
    const state = createInitialState();
    const sceneId = state.document.scenes[0].id;
    state.document.widgets.image_1 = {
      id: 'image_1',
      type: 'image',
      name: 'Image',
      sceneId,
      zIndex: 1,
      frame: { x: 0, y: 0, width: 120, height: 120, rotation: 0 },
      style: {},
      props: { src: 'https://cdn.example.com/hero.png' },
      timeline: { startMs: 0, endMs: 1000 },
    } as any;
    state.document.scenes[0].widgetIds.push('image_1');

    const remoteFetchPlan = buildRemoteAssetFetchPlan(buildExportAssetPlan(buildPortableProjectExport(state)));

    expect(remoteFetchPlan).toHaveLength(1);
    expect(remoteFetchPlan[0]?.sourceUrl).toBe('https://cdn.example.com/hero.png');
    expect(remoteFetchPlan[0]?.packagingPath).toBe('assets/image/image_1/hero.png');
  });

  it('builds package metrics with file and asset breakdown', () => {
    const state = createInitialState();
    const sceneId = state.document.scenes[0].id;
    state.document.widgets.image_1 = {
      id: 'image_1',
      type: 'image',
      name: 'Image',
      sceneId,
      zIndex: 1,
      frame: { x: 0, y: 0, width: 120, height: 120, rotation: 0 },
      style: {},
      props: { src: 'data:text/plain;base64,SGVsbG8=' },
      timeline: { startMs: 0, endMs: 1000 },
    } as any;
    state.document.scenes[0].widgetIds.push('image_1');

    const bundle = buildExportBundle(state);
    const metrics = buildExportPackageMetrics(bundle, buildExportAssetPlan(buildPortableProjectExport(state)));

    expect(metrics.totalFiles).toBeGreaterThan(0);
    expect(metrics.assetCount).toBeGreaterThan(0);
    expect(metrics.materializedAssetCount).toBeGreaterThan(0);
    expect(metrics.binaryBytes).toBeGreaterThan(0);
  });

  it('builds preflight summary with package readiness signals', () => {
    const state = createInitialState();
    const preflight = buildExportPreflight(state);

    expect(preflight.summary.packageGrade).toMatch(/[A-F]/);
    expect(preflight.summary.packageScore).toBeGreaterThanOrEqual(0);
    expect(preflight.summary.packageScore).toBeLessThanOrEqual(100);
    expect(preflight.summary.deliveryMode).toMatch(/blocked|bundle-only|resolved-ready/);
    expect(preflight.summary.preferredArtifact).toMatch(/zip-bundle|zip-resolved/);
    expect(typeof preflight.summary.recommendedNextStep).toBe('string');
    expect(preflight.summary.readyForBundleZip).toBe(preflight.summary.blockers === 0);
  });

  it('surfaces channel blockers and a next step in preflight', () => {
    const state = createInitialState();
    state.document.metadata.release.targetChannel = 'gam-html5';

    const preflight = buildExportPreflight(state);

    expect(preflight.channelBlockers.length).toBeGreaterThan(0);
    expect(preflight.summary.channelErrors).toBeGreaterThan(0);
    expect(preflight.summary.topBlocker).toContain('CTA');
    expect(preflight.summary.recommendedNextStep).toContain('CTA');
    expect(preflight.summary.deliveryMode).toBe('blocked');
  });
});
