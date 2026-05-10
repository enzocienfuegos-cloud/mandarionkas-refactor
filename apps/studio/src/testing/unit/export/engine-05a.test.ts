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

  it('hardens a representative 320x480 mraid interstitial package', () => {
    const state = buildMraidFixtureState('320x480');

    const adapter = buildMraidAdapter(state);
    const bundle = buildExportBundle(state);
    const preflight = buildExportPreflight(state);
    const zip = buildZipFromBundle(bundle, 'MRAID-320x480');

    expect(adapter.mraid.placement).toBe('interstitial');
    expect(adapter.mraid.expectedHost.maxSize).toEqual({ width: 320, height: 480 });
    expect(bundle.files.some((file) => file.path === 'index.html')).toBe(true);
    expect(bundle.files.some((file) => file.path === 'adapter.json')).toBe(true);
    expect(preflight.summary.preferredArtifact).toBe('zip-resolved');
    expect(preflight.summary.blockers).toBe(0);
    expect(preflight.summary.readyForBundleZip).toBe(true);
    expect(zip.filename).toBe('MRAID-320x480.zip');
  });

  it('hardens a representative 300x600 mraid inline package', () => {
    const state = buildMraidFixtureState('300x600');

    const adapter = buildMraidAdapter(state);
    const bundle = buildExportBundle(state);
    const publishPayload = JSON.parse(buildPublishPackage(state));
    const compliance = JSON.parse(bundle.files.find((file) => file.path === 'package-compliance.json')?.content ?? '[]');

    expect(adapter.mraid.placement).toBe('inline');
    expect(adapter.mraid.expectedHost.maxSize).toEqual({ width: 300, height: 600 });
    expect(publishPayload.handoff.mraid).toBeTruthy();
    expect(publishPayload.handoff.mraid.placementType).toBe('inline');
    expect(compliance.some((item: { code?: string; targetId?: string }) => item.code === 'runtime.mraid-placement-review' && item.targetId === 'inline')).toBe(true);
    expect(bundle.files.some((file) => file.path === 'remote-fetch-plan.json')).toBe(true);
  });

  it('materializes inline data-uri assets into bundle files', () => {
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
    const files = materializeExportAssetFiles(assetPlan);

    expect(files).toHaveLength(1);
    expect(files[0]?.path).toContain('assets/image/image_1/');
    expect(files[0]?.bytes?.length).toBeGreaterThan(0);
    expect(files[0]?.mime).toBe('text/plain');
  });

  it('materializes bundled remote assets into bundle files when fetch succeeds', async () => {
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

    const portable = buildPortableProjectExport(state);
    const assetPlan = buildExportAssetPlan(portable);
    const files = await materializeRemoteExportAssetFiles(
      assetPlan,
      async () =>
        new Response(new Uint8Array([1, 2, 3]), {
          status: 200,
          headers: { 'content-type': 'image/png' },
        }),
    );

    expect(files).toHaveLength(1);
    expect(files[0]?.path).toBe('assets/image/image_1/hero.png');
    expect(files[0]?.bytes?.length).toBe(3);
    expect(files[0]?.mime).toBe('image/png');
  });

  it('renders production media widgets with packaged asset paths', () => {
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
      props: { src: 'https://cdn.example.com/hero.png', alt: 'Hero visual' },
      timeline: { startMs: 0, endMs: 1000 },
    } as any;
    state.document.scenes[0].widgetIds.push('hero_1');
    const generic = buildGenericHtml5Adapter(state);

    const html = buildChannelHtml(state, generic);

    expect(html).toContain('<img src="assets/image/hero_1/hero.png"');
    expect(html).toContain('alt="Hero visual"');
    expect(html).toContain('class="banner-stage"');
  });

  it('renders interactive module html for carousel and hotspot export', () => {
    const state = createInitialState();
    const sceneId = state.document.scenes[0].id;
    state.document.widgets.carousel_1 = {
      id: 'carousel_1',
      type: 'image-carousel',
      name: 'Carousel',
      sceneId,
      zIndex: 1,
      frame: { x: 0, y: 0, width: 240, height: 120, rotation: 0 },
      style: { accentColor: '#ffffff' },
      props: {
        title: 'Carousel',
        slides: 'https://cdn.example.com/slide-a.png|Slide A;https://cdn.example.com/slide-b.jpg|Slide B',
      },
      timeline: { startMs: 0, endMs: 1000 },
    } as any;
    state.document.widgets.hotspot_1 = {
      id: 'hotspot_1',
      type: 'interactive-hotspot',
      name: 'Hotspot',
      sceneId,
      zIndex: 2,
      frame: { x: 0, y: 0, width: 240, height: 120, rotation: 0 },
      style: { accentColor: '#f59e0b' },
      props: { label: 'Tap point', hotspotX: 55, hotspotY: 45 },
      timeline: { startMs: 0, endMs: 1000 },
    } as any;
    state.document.scenes[0].widgetIds.push('carousel_1', 'hotspot_1');
    const generic = buildGenericHtml5Adapter(state);

    const html = buildChannelHtml(state, generic);

    expect(html).toContain('data-smx-action="carousel-next"');
    expect(html).toContain('data-carousel-slides=');
    expect(html).toContain('data-smx-action="hotspot-toggle"');
    expect(html).toContain('data-hotspot-panel');
  });
});
