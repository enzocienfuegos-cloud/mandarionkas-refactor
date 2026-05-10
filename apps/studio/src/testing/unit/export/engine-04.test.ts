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

  it('surfaces blocked mraid widgets in channel preflight', () => {
    const state = createInitialState();
    const sceneId = state.document.scenes[0].id;
    state.document.metadata.release.targetChannel = 'mraid';
    state.document.canvas.width = 320;
    state.document.canvas.height = 480;
    state.document.widgets.speed_1 = {
      id: 'speed_1',
      type: 'speed-test',
      name: 'Speed Test',
      sceneId,
      zIndex: 1,
      frame: { x: 0, y: 0, width: 240, height: 180, rotation: 0 },
      style: {},
      props: { title: 'Speed Test' },
      timeline: { startMs: 0, endMs: 1000 },
    } as any;
    state.document.widgets.cta_1 = {
      id: 'cta_1',
      type: 'cta',
      name: 'CTA',
      sceneId,
      zIndex: 2,
      frame: { x: 0, y: 0, width: 160, height: 44, rotation: 0 },
      style: {},
      props: { text: 'Tap now', url: 'https://example.com' },
      timeline: { startMs: 0, endMs: 1000 },
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
    state.document.scenes[0].widgetIds.push('speed_1', 'cta_1');

    const preflight = buildExportPreflight(state);

    expect(preflight.channelBlockers.some((item) => item.id === 'mraid-widget-speed_1')).toBe(true);
    expect(preflight.summary.topBlocker).toContain('speed test');
  });

  it('warns when an mraid creative needs host location support', () => {
    const state = createInitialState();
    const sceneId = state.document.scenes[0].id;
    state.document.metadata.release.targetChannel = 'mraid';
    state.document.canvas.width = 320;
    state.document.canvas.height = 480;
    state.document.widgets.map_1 = {
      id: 'map_1',
      type: 'dynamic-map',
      name: 'Map',
      sceneId,
      zIndex: 1,
      frame: { x: 0, y: 0, width: 280, height: 180, rotation: 0 },
      style: {},
      props: { requestUserLocation: true },
      timeline: { startMs: 0, endMs: 1000 },
    } as any;
    state.document.widgets.cta_1 = {
      id: 'cta_1',
      type: 'cta',
      name: 'CTA',
      sceneId,
      zIndex: 2,
      frame: { x: 0, y: 0, width: 160, height: 44, rotation: 0 },
      style: {},
      props: { text: 'Tap now', url: 'https://example.com' },
      timeline: { startMs: 0, endMs: 1000 },
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
    state.document.scenes[0].widgetIds.push('map_1', 'cta_1');

    const preflight = buildExportPreflight(state);

    expect(preflight.channelWarnings.some((item) => item.id === 'mraid-location-host-support')).toBe(true);
  });

  it('adds package compliance findings for blocked mraid widgets', () => {
    const state = createInitialState();
    const sceneId = state.document.scenes[0].id;
    state.document.metadata.release.targetChannel = 'mraid';
    state.document.canvas.width = 320;
    state.document.canvas.height = 480;
    state.document.widgets.speed_1 = {
      id: 'speed_1',
      type: 'speed-test',
      name: 'Speed Test',
      sceneId,
      zIndex: 1,
      frame: { x: 0, y: 0, width: 240, height: 180, rotation: 0 },
      style: {},
      props: { title: 'Speed Test' },
      timeline: { startMs: 0, endMs: 1000 },
    } as any;
    state.document.scenes[0].widgetIds.push('speed_1');

    const bundle = buildExportBundle(state);
    const compliance = JSON.parse(bundle.files.find((file) => file.path === 'package-compliance.json')?.content ?? '[]');

    expect(compliance.some((item: { code?: string; targetId?: string }) => item.code === 'widget.mraid-blocked-module' && item.targetId === 'speed_1')).toBe(true);
  });

  it('blocks mraid video autoplay with audio enabled', () => {
    const state = createInitialState();
    const sceneId = state.document.scenes[0].id;
    state.document.metadata.release.targetChannel = 'mraid';
    state.document.canvas.width = 320;
    state.document.canvas.height = 480;
    state.document.widgets.video_1 = {
      id: 'video_1',
      type: 'video-hero',
      name: 'Video Hero',
      sceneId,
      zIndex: 1,
      frame: { x: 0, y: 0, width: 260, height: 144, rotation: 0 },
      style: {},
      props: { src: 'https://cdn.example.com/video.mp4', posterSrc: 'https://cdn.example.com/poster.jpg', autoplay: true, muted: false, loop: true, controls: false },
      timeline: { startMs: 0, endMs: 1000 },
    } as any;
    state.document.widgets.cta_1 = {
      id: 'cta_1',
      type: 'cta',
      name: 'CTA',
      sceneId,
      zIndex: 2,
      frame: { x: 0, y: 0, width: 160, height: 44, rotation: 0 },
      style: {},
      props: { text: 'Tap now', url: 'https://example.com' },
      timeline: { startMs: 0, endMs: 1000 },
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
    state.document.scenes[0].widgetIds.push('video_1', 'cta_1');

    const preflight = buildExportPreflight(state);

    expect(preflight.channelBlockers.some((item) => item.id === 'mraid-widget-video_1')).toBe(true);
    expect(preflight.channelBlockers.some((item) => item.label.includes('muted'))).toBe(true);
  });

  it('warns for autoscrolling shoppable units in mraid', () => {
    const state = createInitialState();
    const sceneId = state.document.scenes[0].id;
    state.document.metadata.release.targetChannel = 'mraid';
    state.document.canvas.width = 320;
    state.document.canvas.height = 480;
    state.document.widgets.shop_1 = {
      id: 'shop_1',
      type: 'shoppable-sidebar',
      name: 'Shoppable',
      sceneId,
      zIndex: 1,
      frame: { x: 0, y: 0, width: 300, height: 180, rotation: 0 },
      style: {},
      props: { title: 'Shop', products: 'https://cdn.example.com/a.jpg|One|10|Buy|https://example.com;https://cdn.example.com/b.jpg|Two|10|Buy|https://example.com', autoscroll: true, intervalMs: 2600 },
      timeline: { startMs: 0, endMs: 1000 },
    } as any;
    state.document.widgets.cta_1 = {
      id: 'cta_1',
      type: 'cta',
      name: 'CTA',
      sceneId,
      zIndex: 2,
      frame: { x: 0, y: 0, width: 160, height: 44, rotation: 0 },
      style: {},
      props: { text: 'Tap now', url: 'https://example.com' },
      timeline: { startMs: 0, endMs: 1000 },
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
    state.document.scenes[0].widgetIds.push('shop_1', 'cta_1');

    const preflight = buildExportPreflight(state);

    expect(preflight.channelWarnings.some((item) => item.id === 'mraid-widget-shop_1')).toBe(true);
    expect(preflight.channelWarnings.some((item) => item.label.includes('Autoscrolling shoppable'))).toBe(true);
  });

  it('adds mraid host placement and location warnings to package compliance', () => {
    const state = createInitialState();
    const sceneId = state.document.scenes[0].id;
    state.document.metadata.release.targetChannel = 'mraid';
    state.document.canvas.width = 320;
    state.document.canvas.height = 480;
    state.document.widgets.map_1 = {
      id: 'map_1',
      type: 'dynamic-map',
      name: 'Map',
      sceneId,
      zIndex: 1,
      frame: { x: 0, y: 0, width: 280, height: 180, rotation: 0 },
      style: {},
      props: { requestUserLocation: true },
      timeline: { startMs: 0, endMs: 1000 },
    } as any;
    state.document.widgets.cta_1 = {
      id: 'cta_1',
      type: 'cta',
      name: 'CTA',
      sceneId,
      zIndex: 2,
      frame: { x: 0, y: 0, width: 160, height: 44, rotation: 0 },
      style: {},
      props: { text: 'Tap now', url: 'https://example.com' },
      timeline: { startMs: 0, endMs: 1000 },
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
    state.document.scenes[0].widgetIds.push('map_1', 'cta_1');

    const bundle = buildExportBundle(state);
    const compliance = JSON.parse(bundle.files.find((file) => file.path === 'package-compliance.json')?.content ?? '[]');

    expect(compliance.some((item: { code?: string; targetId?: string }) => item.code === 'runtime.mraid-placement-review' && item.targetId === 'interstitial')).toBe(true);
    expect(compliance.some((item: { code?: string; targetId?: string }) => item.code === 'runtime.mraid-location-host-required' && item.targetId === 'location')).toBe(true);
  });

  it('includes preflight in the publish package payload', () => {
    const state = createInitialState();
    const payload = JSON.parse(buildPublishPackage(state));

    expect(payload.preflight).toBeTruthy();
    expect(payload.handoff).toBeTruthy();
    expect(payload.handoff.preferredArtifact).toMatch(/zip-bundle|zip-resolved/);
    expect(payload.preflight.summary).toBeTruthy();
    expect(payload.preflight.metrics).toBeTruthy();
    expect(payload.preflight.packagingPlan).toBeTruthy();
  });

  it('includes mraid handoff metadata in publish package payload', () => {
    const state = createInitialState();
    state.document.metadata.release.targetChannel = 'mraid';
    state.document.canvas.width = 320;
    state.document.canvas.height = 480;

    const payload = JSON.parse(buildPublishPackage(state));

    expect(payload.handoff.mraid).toBeTruthy();
    expect(payload.handoff.mraid.apiVersion).toBe('3.0');
    expect(payload.handoff.mraid.placementType).toBe('interstitial');
    expect(payload.handoff.mraid.requiredHostFeatures.open).toBe(true);
    expect(payload.handoff.mraid.expectedHost.maxSize).toEqual({ width: 320, height: 480 });
    expect(payload.handoff.mraid.moduleCompatibility).toBeTruthy();
  });

  it('includes preflight in the review package payload', () => {
    const state = createInitialState();
    const payload = JSON.parse(buildReviewPackage(state));

    expect(payload.preflight).toBeTruthy();
    expect(payload.summary.packageGrade).toMatch(/[A-F]/);
    expect(typeof payload.summary.packageScore).toBe('number');
    expect(payload.summary.preferredArtifact).toMatch(/zip-bundle|zip-resolved/);
    expect(payload.handoff.recommendedNextStep).toBeTruthy();
  });

  it('includes mraid handoff metadata in review package payload', () => {
    const state = createInitialState();
    state.document.metadata.release.targetChannel = 'mraid';
    state.document.canvas.width = 320;
    state.document.canvas.height = 480;

    const payload = JSON.parse(buildReviewPackage(state));

    expect(payload.handoff.mraid).toBeTruthy();
    expect(payload.handoff.mraid.placementType).toBe('interstitial');
    expect(payload.handoff.mraid.standardSize).toBe(true);
  });

  it('builds reusable export handoff with module compatibility summary', () => {
    const state = createInitialState();
    state.document.metadata.release.targetChannel = 'mraid';
    state.document.canvas.width = 320;
    state.document.canvas.height = 480;

    const handoff = buildExportHandoff(state);

    expect(handoff.mraid).toBeTruthy();
    expect(handoff.mraid.moduleCompatibility).toBeTruthy();
    expect(typeof handoff.mraid.moduleCompatibility.supportedCount).toBe('number');
    expect(typeof handoff.mraid.moduleCompatibility.warningCount).toBe('number');
    expect(typeof handoff.mraid.moduleCompatibility.blockedCount).toBe('number');
  });
});
