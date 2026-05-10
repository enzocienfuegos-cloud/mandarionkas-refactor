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

  it('builds a playable adapter payload with bootstrap metadata', () => {
    const state = createInitialState();
    const sceneId = state.document.scenes[0].id;
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

    const playable = buildPlayableExportAdapter(state);

    expect(playable.adapter).toBe('playable-ad');
    expect(playable.bootstrap.entrySceneId).toBe(sceneId);
    expect(playable.bootstrap.hasTapGesture).toBe(true);
    expect(playable.bootstrap.clickthroughs[0]?.url).toBe('https://example.com');
  });

  it('builds a generic html5 adapter payload with shell metadata', () => {
    const state = createInitialState();
    state.document.canvas.width = 300;
    state.document.canvas.height = 250;
    state.document.metadata.release.targetChannel = 'generic-html5';

    const generic = buildGenericHtml5Adapter(state);

    expect(generic.adapter).toBe('generic-html5');
    expect(generic.htmlShell.entry).toBe('index.html');
    expect(generic.htmlShell.width).toBe(300);
    expect(generic.htmlShell.height).toBe(250);
  });

  it('builds a gam html5 adapter payload with clickTag expectations', () => {
    const state = createInitialState();
    state.document.metadata.release.targetChannel = 'gam-html5';

    const gam = buildGamHtml5Adapter(state);

    expect(gam.adapter).toBe('gam-html5');
    expect(gam.html5.entry).toBe('index.html');
    expect(gam.html5.requiresClickTag).toBe(true);
  });

  it('renders channel html with clickTag bootstrap for gam html5', () => {
    const state = createInitialState();
    state.document.metadata.release.targetChannel = 'gam-html5';
    const gam = buildGamHtml5Adapter(state);

    const html = buildChannelHtml(state, gam);

    expect(html).toContain('window.ClickTag = window.ClickTag || window.clickTag ||');
    expect(html).toContain('window.clickTag = window.ClickTag;');
    expect(html).toContain('window.smxExit = function smxExit');
    expect(html).toContain('data-adapter="gam-html5"');
    expect(html).toContain('<script src="./runtime.js"></script>');
  });

  it('builds a google display adapter payload with standard size metadata', () => {
    const state = createInitialState();
    state.document.canvas.width = 300;
    state.document.canvas.height = 250;
    state.document.metadata.release.targetChannel = 'google-display';

    const google = buildGoogleDisplayAdapter(state);

    expect(google.adapter).toBe('google-display');
    expect(google.display.entry).toBe('index.html');
    expect(google.display.standardSize).toBe(true);
  });

  it('builds an mraid adapter payload with profile metadata', () => {
    const state = createInitialState();
    state.document.canvas.width = 320;
    state.document.canvas.height = 480;
    state.document.metadata.release.targetChannel = 'mraid';

    const mraid = buildMraidAdapter(state);

    expect(mraid.adapter).toBe('mraid');
    expect(mraid.mraid.entry).toBe('index.html');
    expect(mraid.mraid.standardSize).toBe(true);
    expect(mraid.mraid.placement).toBe('interstitial');
    expect(mraid.mraid.apiVersion).toBe('3.0');
    expect(mraid.mraid.requiredHostFeatures.open).toBe(true);
    expect(mraid.mraid.requiredHostFeatures.location).toBe(false);
    expect(mraid.mraid.expectedHost.placementType).toBe('interstitial');
    expect(mraid.mraid.expectedHost.maxSize).toEqual({ width: 320, height: 480 });
  });

  it('renders channel html with standard-size metadata for google display', () => {
    const state = createInitialState();
    state.document.canvas.width = 300;
    state.document.canvas.height = 250;
    state.document.metadata.release.targetChannel = 'google-display';
    const google = buildGoogleDisplayAdapter(state);

    const html = buildChannelHtml(state, google);

    expect(html).toContain('data-adapter="google-display"');
    expect(html).toContain('window.ClickTag = window.ClickTag || window.clickTag ||');
    expect(html).toContain('window.clickTag = window.ClickTag;');
    expect(html).toContain('class="banner-shell"');
  });

  it('renders channel html with mraid bootstrap', () => {
    const state = createInitialState();
    state.document.canvas.width = 320;
    state.document.canvas.height = 480;
    state.document.metadata.release.targetChannel = 'mraid';
    const mraid = buildMraidAdapter(state);

    const html = buildChannelHtml(state, mraid);

    expect(html).toContain('data-adapter="mraid"');
    expect(html).toContain('window.mraid');
    expect(html).toContain('window.smxExit = function smxExit');
    expect(html).toContain('data-mraid-ready');
    expect(html).toContain("window.smxMraidState = {");
    expect(html).toContain("window.mraid.addEventListener('stateChange', handleStateChange);");
    expect(html).toContain("window.mraid.addEventListener('viewableChange', handleViewableChange);");
    expect(html).toContain("window.mraid.addEventListener('sizeChange', handleSizeChange);");
    expect(html).toContain("window.mraid.addEventListener('error', handleError);");
    expect(html).toContain("data-mraid-state");
    expect(html).toContain("data-mraid-viewable");
    expect(html).toContain("getMaxSize");
    expect(html).toContain("getScreenSize");
    expect(html).toContain("smx:mraid-change");
  });

  it('renders localized asset paths in channel html when adapter project is localized', () => {
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

    const adapter = buildGenericHtml5Adapter(state);
    const assetPlan = buildExportAssetPlan(adapter.portableProject);
    const localizedAdapter = {
      ...adapter,
      portableProject: buildLocalizedPortableProject(adapter.portableProject, assetPlan),
    };

    const html = buildChannelHtml(state, localizedAdapter);

    expect(html).toContain('assets/image/hero_1/hero.png');
    expect(html).not.toContain('https://cdn.example.com/hero.png');
  });

  it('renders countdown widgets as exportable countdown markup', () => {
    const state = createInitialState();
    const sceneId = state.document.scenes[0].id;
    state.document.widgets.countdown_1 = {
      id: 'countdown_1',
      type: 'countdown',
      name: 'Countdown',
      sceneId,
      zIndex: 1,
      frame: { x: 0, y: 0, width: 240, height: 120, rotation: 0 },
      style: { backgroundColor: '#1f2937', accentColor: '#f59e0b', color: '#ffffff' },
      props: { title: 'Countdown', days: 1, hours: 2, minutes: 3, seconds: 4 },
      timeline: { startMs: 0, endMs: 1000 },
    } as any;
    state.document.scenes[0].widgetIds.push('countdown_1');

    const html = buildChannelHtml(state, buildGenericHtml5Adapter(state));

    expect(html).toContain('widget-countdown');
    expect(html).toContain('data-countdown-seconds');
    expect(html).toContain('data-countdown-value="DD"');
  });

  it('builds a file-oriented export bundle', () => {
    const state = createInitialState();
    const bundle = buildExportBundle(state);

    expect(bundle.files.some((file) => file.path === 'index.html')).toBe(true);
    expect(bundle.files.some((file) => file.path === 'runtime.js')).toBe(true);
    expect(bundle.files.some((file) => file.path === 'manifest.json')).toBe(true);
    expect(bundle.files.some((file) => file.path === 'adapter.json')).toBe(true);
    expect(bundle.files.some((file) => file.path === 'packaging-plan.json')).toBe(true);
    expect(bundle.files.some((file) => file.path === 'exit-config.json')).toBe(true);
    expect(bundle.files.some((file) => file.path === 'asset-plan.json')).toBe(true);
    expect(bundle.files.some((file) => file.path === 'remote-fetch-plan.json')).toBe(true);
    expect(bundle.files.some((file) => file.path === 'package-metrics.json')).toBe(true);
    expect(bundle.files.some((file) => file.path === 'package-compliance.json')).toBe(true);
    expect(bundle.files.find((file) => file.path === 'index.html')?.content).toContain('smx-export-manifest');
  });
});
