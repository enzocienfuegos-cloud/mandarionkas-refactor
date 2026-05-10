import { describe, expect, it } from 'vitest';
import { createInitialState } from '../../../domain/document/factories';
import { buildChannelHtml, buildExportAssetPlan, buildExportBundle, buildExportBundleWithRemoteAssets, buildExportExitConfig, buildExportHandoff, buildExportManifest, buildExportPackagingPlan, buildExportPackageMetrics, buildExportPreflight, buildExportReadiness, buildExportRuntimeModel, buildExportSizeSetBundle, buildExportSizeSetBundleWithRemoteAssets, buildGamHtml5Adapter, buildGenericHtml5Adapter, buildGoogleDisplayAdapter, buildMraidAdapter, buildPlayableExportAdapter, buildPlayableSingleFileHtml, buildLocalizedPortableProject, buildPortableProjectExport, buildPublishPackage, buildRemoteAssetFetchPlan, buildReviewPackage, buildStandaloneHtml, buildVastSimidAdapter, buildVastSimidXml, buildZipFromBundle, compileRuntime, getChannelRequirements, materializeExportAssetFiles, materializeRemoteExportAssetFiles, validateExport, validateExportPackage, validatePortableExport } from '../../../export/engine';
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

  it('renders shoppable sidebar widgets as product cards with export interactions', () => {
    const state = createInitialState();
    const sceneId = state.document.scenes[0].id;
    state.document.widgets.shop_1 = {
      id: 'shop_1',
      type: 'shoppable-sidebar',
      name: 'Shoppable Sidebar',
      sceneId,
      zIndex: 1,
      frame: { x: 0, y: 0, width: 320, height: 180, rotation: 0 },
      style: { accentColor: '#9a3412', color: '#1f2937', backgroundColor: '#f8fafc', borderRadius: 20 },
      props: {
        title: 'Shop the look',
        orientation: 'horizontal',
        cardShape: 'portrait',
        autoscroll: true,
        intervalMs: 2600,
        products: 'https://cdn.example.com/bag.png|Bracelet Duo|Casuale Damier|250 €|4|Shop now|https://example.com/bag;https://cdn.example.com/shoes.png|House de Sac|Premium line|550 €|5|Buy now|https://example.com/shoes',
      },
      timeline: { startMs: 0, endMs: 1000 },
    } as any;
    state.document.scenes[0].widgetIds.push('shop_1');
    const generic = buildGenericHtml5Adapter(state);

    const html = buildChannelHtml(state, generic);

    expect(html).toContain('class="widget widget-shoppable-sidebar"');
    expect(html).toContain('data-shoppable-products=');
    expect(html).toContain('data-smx-action="shoppable-cta"');
    expect(html).toContain('Bracelet Duo');
    expect(html).toContain('250 €');
  });

  it('renders weather widgets with live weather metadata for export', () => {
    const state = createInitialState();
    const sceneId = state.document.scenes[0].id;
    state.document.widgets.weather_1 = {
      id: 'weather_1',
      type: 'weather-conditions',
      name: 'Weather',
      sceneId,
      zIndex: 1,
      frame: { x: 0, y: 0, width: 280, height: 150, rotation: 0 },
      style: { accentColor: '#60a5fa', color: '#0f172a', backgroundColor: '#f8fafc' },
      props: {
        title: 'Weather',
        location: 'San Salvador',
        condition: 'Cloudy',
        temperature: 24,
        latitude: 13.6929,
        longitude: -89.2182,
        provider: 'open-meteo',
        fetchPolicy: 'cache-first',
        cacheTtlMs: 300000,
        liveWeather: true,
      },
      timeline: { startMs: 0, endMs: 1000 },
    } as any;
    state.document.scenes[0].widgetIds.push('weather_1');
    const generic = buildGenericHtml5Adapter(state);

    const html = buildChannelHtml(state, generic);

    expect(html).toContain('class="widget widget-weather-conditions"');
    expect(html).toContain('data-weather-provider="open-meteo"');
    expect(html).toContain('data-weather-live="true"');
    expect(html).toContain('data-weather-location="San Salvador"');
  });

  it('builds a runtime script that wires CTA exits and scene controls', () => {
    const state = createInitialState();
    state.document.metadata.release.targetChannel = 'gam-html5';
    const gam = buildGamHtml5Adapter(state);

    const script = compileRuntime(gam.portableProject, gam);

    expect(script).toContain('document.querySelectorAll(\'.widget-cta[data-widget-id]\')');
    expect(script).toContain('window.smxRuntime=');
    expect(script).toContain('showScene(0)');
    expect(script).not.toContain('initWeatherWidget');
    expect(script).not.toContain('api.open-meteo.com');
  });

  it('builds a runtime script that prefers mraid location for locator flows', () => {
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
    state.document.scenes[0].widgetIds.push('map_1');
    const mraid = buildMraidAdapter(state);

    const script = compileRuntime(mraid.portableProject, mraid);

    expect(script).toContain('function requestMraidUserPosition');
    expect(script).toContain('window.mraid.getLocation');
    expect(script).toContain('parseUserPositionPayload');
    expect(script).toContain('if (requestMraidUserPosition(onSuccess, onError)) return;');
  });

  it('builds a zip artifact from the export bundle', () => {
    const state = createInitialState();
    const bundle = buildExportBundle(state);

    const zip = buildZipFromBundle(bundle, 'Studio Export');

    expect(zip.filename).toBe('Studio-Export.zip');
    expect(zip.mime).toBe('application/zip');
    expect(zip.bytes[0]).toBe(0x50);
    expect(zip.bytes[1]).toBe(0x4b);
    expect(zip.bytes[2]).toBe(0x03);
    expect(zip.bytes[3]).toBe(0x04);
  });

  it('builds a multi-size bundle with one sub-bundle per canvas variant', () => {
    let state = createInitialState({ canvasPresetId: 'wide-skyscraper' });
    const sceneId = state.document.scenes[0].id;
    state.document.name = 'Multi-size Export';
    state.document.widgets.text_1 = {
      id: 'text_1',
      type: 'text',
      name: 'Headline',
      sceneId,
      zIndex: 1,
      frame: { x: 20, y: 32, width: 180, height: 48, rotation: 0 },
      style: { color: '#ffffff' },
      props: { text: 'Master headline' },
      timeline: { startMs: 0, endMs: 1000 },
    } as any;
    state.document.scenes[0].widgetIds.push('text_1');
    state = documentSceneReducer(state, { type: 'ADD_CANVAS_VARIANT', presetId: 'medium-rectangle' });
    const variantId = state.document.activeCanvasVariantId;
    state.document.widgetOverrides[variantId] = {
      text_1: {
        frame: { x: 44, y: 16, width: 140 },
      },
    };

    const bundle = buildExportSizeSetBundle(state);

    expect(bundle.files.some((file) => file.path === 'bundle/300x600/index.html')).toBe(true);
    expect(bundle.files.some((file) => file.path === 'bundle/300x250/index.html')).toBe(true);
    expect(bundle.files.some((file) => file.path === 'bundle/manifest.json')).toBe(true);

    const sizeSetManifest = JSON.parse(bundle.files.find((file) => file.path === 'bundle/manifest.json')?.content ?? '{}');
    expect(sizeSetManifest.variantCount).toBe(2);
    expect(sizeSetManifest.variants.map((variant: { slug: string }) => variant.slug)).toEqual(['300x600', '300x250']);
  });

  it('materializes variant-local frame overrides into the matching portable project bundle only', () => {
    let state = createInitialState({ canvasPresetId: 'wide-skyscraper' });
    const sceneId = state.document.scenes[0].id;
    state.document.widgets.text_1 = {
      id: 'text_1',
      type: 'text',
      name: 'Headline',
      sceneId,
      zIndex: 1,
      frame: { x: 20, y: 32, width: 180, height: 48, rotation: 0 },
      style: { color: '#ffffff' },
      props: { text: 'Master headline' },
      timeline: { startMs: 0, endMs: 1000 },
    } as any;
    state.document.scenes[0].widgetIds.push('text_1');
    state = documentSceneReducer(state, { type: 'ADD_CANVAS_VARIANT', presetId: 'medium-rectangle' });
    const variantId = state.document.activeCanvasVariantId;
    state.document.widgetOverrides[variantId] = {
      text_1: {
        frame: { x: 44, y: 16, width: 140 },
      },
    };

    const bundle = buildExportSizeSetBundle(state);
    const masterPortable = JSON.parse(bundle.files.find((file) => file.path === 'bundle/300x600/portable-project.json')?.content ?? '{}');
    const variantPortable = JSON.parse(bundle.files.find((file) => file.path === 'bundle/300x250/portable-project.json')?.content ?? '{}');
    const masterWidget = masterPortable.scenes?.[0]?.widgets?.find((widget: { id: string }) => widget.id === 'text_1');
    const variantWidget = variantPortable.scenes?.[0]?.widgets?.find((widget: { id: string }) => widget.id === 'text_1');

    expect(masterWidget?.frame.x).toBe(20);
    expect(masterWidget?.frame.width).toBe(180);
    expect(variantWidget?.frame.x).toBe(44);
    expect(variantWidget?.frame.width).toBe(140);
  });

  it('deduplicates shared size-set assets into bundle/shared and rewrites localized project paths', () => {
    let state = createInitialState({ canvasPresetId: 'wide-skyscraper' });
    const sceneId = state.document.scenes[0].id;
    state.document.widgets.image_1 = {
      id: 'image_1',
      type: 'image',
      name: 'Shared Image',
      sceneId,
      zIndex: 1,
      frame: { x: 0, y: 0, width: 120, height: 120, rotation: 0 },
      style: {},
      props: { src: 'data:text/plain;base64,SGVsbG8=' },
      timeline: { startMs: 0, endMs: 1000 },
    } as any;
    state.document.scenes[0].widgetIds.push('image_1');
    state = documentSceneReducer(state, { type: 'ADD_CANVAS_VARIANT', presetId: 'medium-rectangle' });

    const bundle = buildExportSizeSetBundle(state);
    const sharedAssetFiles = bundle.files.filter((file) => file.path.startsWith('bundle/shared/assets/'));
    const masterLocalized = JSON.parse(bundle.files.find((file) => file.path === 'bundle/300x600/portable-project.localized.json')?.content ?? '{}');
    const variantLocalized = JSON.parse(bundle.files.find((file) => file.path === 'bundle/300x250/portable-project.localized.json')?.content ?? '{}');
    const masterAssetRef = masterLocalized.scenes?.[0]?.widgets?.[0]?.assetRefs?.[0]?.src;
    const variantAssetRef = variantLocalized.scenes?.[0]?.widgets?.[0]?.assetRefs?.[0]?.src;
    const sizeSetManifest = JSON.parse(bundle.files.find((file) => file.path === 'bundle/manifest.json')?.content ?? '{}');

    expect(sharedAssetFiles).toHaveLength(1);
    expect(masterAssetRef).toMatch(/^\.\.\/shared\/assets\//);
    expect(variantAssetRef).toBe(masterAssetRef);
    expect(sizeSetManifest.sharedAssetCount).toBe(1);
    expect(sizeSetManifest.sharedAssets?.[0]?.path).toBe(sharedAssetFiles[0]?.path);
  });

  it('includes materialized inline asset binaries in the bundle', () => {
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
    const assetFile = bundle.files.find((file) => file.path.includes('assets/image/image_1/'));

    expect(assetFile).toBeTruthy();
    expect(assetFile?.bytes?.length).toBeGreaterThan(0);
  });

  it('builds a resolved bundle with remote assets materialized when fetch succeeds', async () => {
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

    const bundle = await buildExportBundleWithRemoteAssets(
      state,
      async () =>
        new Response(new Uint8Array([137, 80, 78, 71]), {
          status: 200,
          headers: { 'content-type': 'image/png' },
        }),
    );

    const assetFile = bundle.files.find((file) => file.path === 'assets/image/hero_1/hero.png');
    const compliance = bundle.files.find((file) => file.path === 'package-compliance.json')?.content ?? '[]';
    expect(assetFile?.bytes?.length).toBe(4);
    expect(compliance).not.toContain('asset.bundle-materialization-pending');
  });

  it('flags package issues when clickTag channels have no primary exit url', () => {
    const state = createInitialState();
    state.document.metadata.release.targetChannel = 'gam-html5';
    const bundle = buildExportBundle(state);
    const gam = buildGamHtml5Adapter(state);
    const packagingPlan = buildExportPackagingPlan(gam);
    const exitConfig = buildExportExitConfig(gam);
    const assetPlan = buildExportAssetPlan(buildPortableProjectExport(state));

    const issues = validateExportPackage(bundle, packagingPlan, exitConfig, assetPlan);

    expect(issues.some((issue) => issue.code === 'exit.missing-primary-url')).toBe(true);
  });
});
