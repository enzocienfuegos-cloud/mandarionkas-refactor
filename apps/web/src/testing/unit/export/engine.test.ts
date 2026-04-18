import { describe, expect, it } from 'vitest';
import { createInitialState } from '../../../domain/document/factories';
import { buildChannelHtml, buildExportAssetPlan, buildExportBundle, buildExportBundleWithRemoteAssets, buildExportExitConfig, buildExportManifest, buildExportPackagingPlan, buildExportPackageMetrics, buildExportPreflight, buildExportReadiness, buildExportRuntimeModel, buildExportRuntimeScript, buildGamHtml5Adapter, buildGenericHtml5Adapter, buildGoogleDisplayAdapter, buildMraidAdapter, buildPlayableExportAdapter, buildLocalizedPortableProject, buildPortableProjectExport, buildPublishPackage, buildRemoteAssetFetchPlan, buildReviewPackage, buildStandaloneHtml, buildZipFromBundle, getChannelRequirements, materializeExportAssetFiles, materializeRemoteExportAssetFiles, validateExport, validateExportPackage, validatePortableExport } from '../../../export/engine';
import { buildNearbyPlacesCsv, parseNearbyPlaces } from '../../../widgets/modules/dynamic-map.shared';

describe('export engine', () => {
  it('round-trips nearby places csv with badges and custom ctas', () => {
    const csv = buildNearbyPlacesCsv([
      {
        name: 'San Salvador',
        flag: 'SV',
        lat: 13.6929,
        lng: -89.2182,
        address: 'Centro Comercial',
        badge: 'Open now',
        openNow: true,
        ctaLabel: 'Open in Maps',
        ctaType: 'maps',
        ctaUrl: '',
      },
      {
        name: 'Santa Tecla',
        flag: 'SV',
        lat: 13.6769,
        lng: -89.2797,
        address: 'Plaza Merliot',
        badge: 'Drive-thru',
        openNow: false,
        ctaLabel: 'Visit site',
        ctaType: 'site',
        ctaUrl: 'https://example.com/store',
      },
    ]);

    const places = parseNearbyPlaces(csv);

    expect(places).toHaveLength(2);
    expect(places[0]?.badge).toBe('Open now');
    expect(places[1]?.ctaType).toBe('site');
    expect(places[1]?.ctaUrl).toBe('https://example.com/store');
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

  it('warns google display exports when playable-only gestures are present', () => {
    const state = createInitialState();
    state.document.metadata.release.targetChannel = 'google-display';
    const sceneId = state.document.scenes[0].id;
    state.document.widgets.slider_1 = {
      id: 'slider_1',
      type: 'range-slider',
      name: 'Range Slider',
      sceneId,
      zIndex: 1,
      frame: { x: 0, y: 0, width: 220, height: 84, rotation: 0 },
      style: {},
      props: { title: 'Slide to compare' },
      timeline: { startMs: 0, endMs: 1000 },
    } as any;
    state.document.scenes[0].widgetIds.push('slider_1');

    const checklist = getChannelRequirements('google-display', state);

    expect(checklist.some((item) => item.id === 'gwd-no-playable-gestures' && !item.passed)).toBe(true);
  });

  it('warns generic html5 interactive exports when they have no clickthrough path', () => {
    const state = createInitialState();
    state.document.metadata.release.targetChannel = 'generic-html5';
    const sceneId = state.document.scenes[0].id;
    state.document.widgets.buttons_1 = {
      id: 'buttons_1',
      type: 'buttons',
      name: 'Buttons',
      sceneId,
      zIndex: 1,
      frame: { x: 0, y: 0, width: 220, height: 96, rotation: 0 },
      style: {},
      props: { title: 'Buttons', primaryLabel: 'Go', secondaryLabel: 'Later', orientation: 'horizontal' },
      timeline: { startMs: 0, endMs: 1000 },
    } as any;
    state.document.scenes[0].widgetIds.push('buttons_1');

    const checklist = getChannelRequirements('generic-html5', state);

    expect(checklist.some((item) => item.id === 'html5-exit' && !item.passed)).toBe(true);
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

  it('builds a portable project export with scenes, interactions and assets', () => {
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
    state.document.actions.act_1 = {
      id: 'act_1',
      widgetId: 'hero_1',
      trigger: 'click',
      type: 'go-to-scene',
      targetSceneId: sceneId,
      label: 'Advance',
    };
    state.document.scenes[0].widgetIds.push('hero_1');

    const portable = buildPortableProjectExport(state);

    expect(portable.scenes).toHaveLength(1);
    expect(portable.scenes[0].widgets[0].id).toBe('hero_1');
    expect(portable.interactions[0]?.id).toBe('act_1');
    expect(portable.assets[0]?.src).toContain('hero.png');
  });

  it('flags portable interactive widgets that have no export action', () => {
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
      props: { text: 'Tap now' },
      timeline: { startMs: 0, endMs: 1000 },
    } as any;
    state.document.scenes[0].widgetIds.push('cta_1');

    const issues = validatePortableExport(buildPortableProjectExport(state));

    expect(issues.some((issue) => issue.code === 'widget.interactive-without-action')).toBe(true);
  });

  it('builds a runtime model with gesture semantics for playable widgets', () => {
    const state = createInitialState();
    const sceneId = state.document.scenes[0].id;
    state.document.widgets.slider_1 = {
      id: 'slider_1',
      type: 'range-slider',
      name: 'Range Slider',
      sceneId,
      zIndex: 1,
      frame: { x: 0, y: 0, width: 220, height: 84, rotation: 0 },
      style: {},
      props: { title: 'Slide to compare' },
      timeline: { startMs: 0, endMs: 1000 },
    } as any;
    state.document.scenes[0].widgetIds.push('slider_1');

    const runtime = buildExportRuntimeModel(state);

    expect(runtime.scenes[0].widgets[0].interactive).toBe(true);
    expect(runtime.scenes[0].widgets[0].gestures).toContain('drag');
    expect(runtime.scenes[0].widgets[0].gestures).toContain('slider');
  });

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

    expect(html).toContain('window.clickTag = window.clickTag ||');
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
  });

  it('renders channel html with standard-size metadata for google display', () => {
    const state = createInitialState();
    state.document.canvas.width = 300;
    state.document.canvas.height = 250;
    state.document.metadata.release.targetChannel = 'google-display';
    const google = buildGoogleDisplayAdapter(state);

    const html = buildChannelHtml(state, google);

    expect(html).toContain('data-adapter="google-display"');
    expect(html).toContain('window.clickTag = window.clickTag ||');
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

    expect(preflight.channelBlockers.some((item) => item.id === 'mraid-widget-speed-test')).toBe(true);
    expect(preflight.summary.topBlocker).toContain('speed test');
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

    expect(compliance.some((item: { code?: string; targetId?: string }) => item.code === 'widget.mraid-blocked-module' && item.targetId === 'speed-test')).toBe(true);
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

  it('includes preflight in the review package payload', () => {
    const state = createInitialState();
    const payload = JSON.parse(buildReviewPackage(state));

    expect(payload.preflight).toBeTruthy();
    expect(payload.summary.packageGrade).toMatch(/[A-F]/);
    expect(typeof payload.summary.packageScore).toBe('number');
    expect(payload.summary.preferredArtifact).toMatch(/zip-bundle|zip-resolved/);
    expect(payload.handoff.recommendedNextStep).toBeTruthy();
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

  it('renders interactive module html for buttons and interactive gallery export', () => {
    const state = createInitialState();
    const sceneId = state.document.scenes[0].id;
    state.document.widgets.buttons_1 = {
      id: 'buttons_1',
      type: 'buttons',
      name: 'Buttons',
      sceneId,
      zIndex: 1,
      frame: { x: 0, y: 0, width: 220, height: 96, rotation: 0 },
      style: { accentColor: '#67e8f9', color: '#ffffff', backgroundColor: '#0f766e' },
      props: { title: 'Buttons', primaryLabel: 'Buy now', secondaryLabel: 'Learn more', orientation: 'horizontal' },
      timeline: { startMs: 0, endMs: 1000 },
    } as any;
    state.document.widgets.gallery_1 = {
      id: 'gallery_1',
      type: 'interactive-gallery',
      name: 'Gallery',
      sceneId,
      zIndex: 2,
      frame: { x: 0, y: 0, width: 240, height: 128, rotation: 0 },
      style: { accentColor: '#111827', color: '#111827', backgroundColor: '#ffffff' },
      props: { title: 'Gallery', itemCount: 4, activeIndex: 2 },
      timeline: { startMs: 0, endMs: 1000 },
    } as any;
    state.document.scenes[0].widgetIds.push('buttons_1', 'gallery_1');
    const generic = buildGenericHtml5Adapter(state);

    const html = buildChannelHtml(state, generic);

    expect(html).toContain('class="widget widget-buttons"');
    expect(html).toContain('data-smx-action="button-select"');
    expect(html).toContain('class="widget widget-interactive-gallery"');
    expect(html).toContain('data-smx-action="gallery-next"');
    expect(html).toContain('data-gallery-card');
  });

  it('renders qr code and dynamic map widgets as exportable html', () => {
    const state = createInitialState();
    const sceneId = state.document.scenes[0].id;
    state.document.widgets.qr_1 = {
      id: 'qr_1',
      type: 'qr-code',
      name: 'QR Code',
      sceneId,
      zIndex: 1,
      frame: { x: 0, y: 0, width: 220, height: 116, rotation: 0 },
      style: { accentColor: '#111827', color: '#111827', backgroundColor: '#ffffff' },
      props: { title: 'QR Code', url: 'https://example.com', codeLabel: 'Scan me' },
      timeline: { startMs: 0, endMs: 1000 },
    } as any;
    state.document.widgets.map_1 = {
      id: 'map_1',
      type: 'dynamic-map',
      name: 'Dynamic Map',
      sceneId,
      zIndex: 2,
      frame: { x: 0, y: 0, width: 220, height: 118, rotation: 0 },
      style: { accentColor: '#ef4444', color: '#ffffff', backgroundColor: '#1f2937' },
      props: {
        title: 'Dynamic Map',
        location: 'San Salvador',
        latitude: 13.6929,
        longitude: -89.2182,
        zoom: 13,
        provider: 'manual',
        requestUserLocation: true,
        ctaType: 'maps',
        ctaLabel: 'Open in Maps',
        markersCsv: 'name,flag,lat,lng,address,badge,openNow,ctaLabel,ctaType,ctaUrl\nSan Salvador,SV,13.6929,-89.2182,Centro Comercial,Open now,true,Open in Maps,maps,',
      },
      timeline: { startMs: 0, endMs: 1000 },
    } as any;
    state.document.scenes[0].widgetIds.push('qr_1', 'map_1');
    const generic = buildGenericHtml5Adapter(state);

    const html = buildChannelHtml(state, generic);

    expect(html).toContain('class="widget widget-qr-code"');
    expect(html).toContain('data-smx-action="qr-open"');
    expect(html).toContain('class="widget widget-dynamic-map"');
    expect(html).toContain('data-map-places=');
    expect(html).toContain('data-smx-action="map-place-cta"');
    expect(html).toContain('zoom 13');
    expect(html).toContain('San Salvador');
  });

  it('renders dynamic map search-bar locators with custom copy and localized assets', () => {
    const state = createInitialState();
    const sceneId = state.document.scenes[0].id;
    state.document.widgets.map_search_1 = {
      id: 'map_search_1',
      type: 'dynamic-map',
      name: 'Nearby Search',
      sceneId,
      zIndex: 1,
      frame: { x: 0, y: 0, width: 320, height: 180, rotation: 0 },
      style: { accentColor: '#ef4444', color: '#ffffff', backgroundColor: '#1f2937' },
      props: {
        title: 'Nearby Search',
        renderMode: 'search-bar',
        provider: 'manual',
        requestUserLocation: true,
        heroImage: 'https://cdn.example.com/hero-map.jpg',
        logoImage: 'https://cdn.example.com/logo-map.png',
        headlineText: 'Estamos cerca de ti',
        infoLabelText: 'Busca una tienda',
        locateMeLabel: 'Ubicame',
        directionsCtaLabel: 'Como llegar',
        nearbyTitleText: 'Mas cercanas',
        markersCsv: 'name,flag,lat,lng,address,badge,openNow,ctaLabel,ctaType,ctaUrl\nSan Salvador,SV,13.6929,-89.2182,Centro Comercial,Open now,true,Open in Maps,maps,\nSanta Tecla,SV,13.6769,-89.2797,Plaza Merliot,Drive-thru,false,Open in Waze,waze,',
      },
      timeline: { startMs: 0, endMs: 1000 },
    } as any;
    state.document.scenes[0].widgetIds.push('map_search_1');

    const generic = buildGenericHtml5Adapter(state);
    const html = buildChannelHtml(state, generic);
    const portable = buildPortableProjectExport(state);
    const assetPlan = buildExportAssetPlan(portable);
    const localized = buildLocalizedPortableProject(portable, assetPlan);

    expect(html).toContain('widget-dynamic-map-search');
    expect(html).toContain('data-map-render-mode="search-bar"');
    expect(html).toContain('data-smx-action="map-open-panel"');
    expect(html).toContain('data-smx-action="map-request-location"');
    expect(html).toContain('Busca una tienda');
    expect(assetPlan.some((entry) => entry.sourceUrl.includes('hero-map.jpg'))).toBe(true);
    expect(assetPlan.some((entry) => entry.sourceUrl.includes('logo-map.png'))).toBe(true);
    expect(String(localized.scenes[0].widgets[0].props.heroImage ?? '')).toContain('assets/image/map_search_1/');
    expect(String(localized.scenes[0].widgets[0].props.logoImage ?? '')).toContain('assets/image/map_search_1/');
  });

  it('renders speed test widgets as playable demo html', () => {
    const state = createInitialState();
    const sceneId = state.document.scenes[0].id;
    state.document.widgets.speed_1 = {
      id: 'speed_1',
      type: 'speed-test',
      name: 'Speed Test',
      sceneId,
      zIndex: 1,
      frame: { x: 0, y: 0, width: 220, height: 116, rotation: 0 },
      style: { accentColor: '#2dd4bf', color: '#ffffff', backgroundColor: '#0b3b7a' },
      props: { title: 'Speed Test', min: 10, max: 100, current: 64, units: 'Mbps', durationMs: 1800, ctaLabel: 'Start test', resultMode: 'random', fastThreshold: 70, fastMessage: 'WOW, very fast network', slowMessage: 'Slow connection' },
      timeline: { startMs: 0, endMs: 1000 },
    } as any;
    state.document.scenes[0].widgetIds.push('speed_1');
    const generic = buildGenericHtml5Adapter(state);

    const html = buildChannelHtml(state, generic);

    expect(html).toContain('class="widget widget-speed-test"');
    expect(html).toContain('data-smx-action="speed-test-start"');
    expect(html).toContain('data-speed-duration="1800"');
    expect(html).toContain('data-speed-result-mode="random"');
    expect(html).toContain('data-speed-fast-threshold="70"');
    expect(html).toContain('WOW, very fast network');
  });

  it('renders scratch reveal widgets with canvas-based scratch interactions', () => {
    const state = createInitialState();
    const sceneId = state.document.scenes[0].id;
    state.document.widgets.scratch_1 = {
      id: 'scratch_1',
      type: 'scratch-reveal',
      name: 'Scratch & Reveal',
      sceneId,
      zIndex: 1,
      frame: { x: 0, y: 0, width: 220, height: 116, rotation: 0 },
      style: { accentColor: '#f97316', color: '#ffffff', backgroundColor: '#111827' },
      props: {
        title: 'Scratch & Reveal',
        coverLabel: 'Scratch to reveal',
        revealLabel: '20% off today',
        beforeImage: 'https://cdn.example.com/cover.png',
        afterImage: 'https://cdn.example.com/reveal.png',
        coverBlur: 8,
        scratchRadius: 24,
      },
      timeline: { startMs: 0, endMs: 1000 },
    } as any;
    state.document.scenes[0].widgetIds.push('scratch_1');
    const generic = buildGenericHtml5Adapter(state);

    const html = buildChannelHtml(state, generic);

    expect(html).toContain('class="scratch-reveal-shell"');
    expect(html).toContain('data-scratch-canvas');
    expect(html).toContain('data-scratch-cover-image="https://cdn.example.com/cover.png"');
    expect(html).not.toContain('data-smx-action="scratch-update"');
    expect(html).not.toContain('type="range"');
  });

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

    const script = buildExportRuntimeScript(gam);

    expect(script).toContain('document.querySelectorAll(\'.widget-cta[data-widget-id]\')');
    expect(script).toContain('window.smxRuntime =');
    expect(script).toContain('showScene(0)');
    expect(script).toContain('updateCarousel');
    expect(script).toContain('updateGallery');
    expect(script).toContain('button-select');
    expect(script).toContain('hotspot-toggle');
    expect(script).toContain('qr-open');
    expect(script).toContain('speed-test-start');
    expect(script).toContain('runSpeedTest');
    expect(script).toContain('initScratchReveal');
    expect(script).toContain('data-scratch-canvas');
    expect(script).toContain('updateShoppable');
    expect(script).toContain('shoppable-cta');
    expect(script).toContain('renderMapCards');
    expect(script).toContain('renderMapSearchBar');
    expect(script).toContain('map-place-cta');
    expect(script).toContain('initWeatherWidget');
    expect(script).toContain('api.open-meteo.com');
  });

  it('builds a runtime script that prefers mraid location for locator flows', () => {
    const state = createInitialState();
    state.document.metadata.release.targetChannel = 'mraid';
    state.document.canvas.width = 320;
    state.document.canvas.height = 480;
    const mraid = buildMraidAdapter(state);

    const script = buildExportRuntimeScript(mraid);

    expect(script).toContain('function requestMraidUserPosition');
    expect(script).toContain('window.mraid.getLocation');
    expect(script).toContain('window.smxMraidState');
    expect(script).toContain('supports.location');
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

  it('flags when localized asset paths are declared but binary assets are not materialized', () => {
    const state = createInitialState();
    const sceneId = state.document.scenes[0].id;
    state.document.metadata.release.targetChannel = 'gam-html5';
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
    const bundle = buildExportBundle(state);
    const gam = buildGamHtml5Adapter(state);
    const assetPlan = buildExportAssetPlan(buildPortableProjectExport(state));
    const localizedAdapter = { ...gam, portableProject: buildLocalizedPortableProject(gam.portableProject, assetPlan) };
    const issues = validateExportPackage(bundle, buildExportPackagingPlan(localizedAdapter), buildExportExitConfig(localizedAdapter), assetPlan);

    expect(issues.some((issue) => issue.code === 'asset.bundle-materialization-pending')).toBe(true);
    expect(issues.some((issue) => issue.code === 'asset.clicktag-channel-materialization-required')).toBe(true);
  });

  it('errors when google display packages still have localized assets pending materialization', () => {
    const state = createInitialState();
    const sceneId = state.document.scenes[0].id;
    state.document.metadata.release.targetChannel = 'google-display';
    state.document.widgets.hero_1 = {
      id: 'hero_1',
      type: 'hero-image',
      name: 'Hero',
      sceneId,
      zIndex: 1,
      frame: { x: 0, y: 0, width: 320, height: 180, rotation: 0 },
      style: {},
      props: { src: 'https://cdn.example.com/hero.png', url: 'https://example.com' },
      timeline: { startMs: 0, endMs: 1000 },
      actions: [],
    } as any;
    state.document.actions.act_1 = {
      id: 'act_1',
      widgetId: 'hero_1',
      trigger: 'click',
      type: 'open-url',
      url: 'https://example.com',
      label: 'Exit',
    };
    state.document.scenes[0].widgetIds.push('hero_1');

    const bundle = buildExportBundle(state);
    const google = buildGoogleDisplayAdapter(state);
    const issues = validateExportPackage(
      bundle,
      buildExportPackagingPlan(google),
      buildExportExitConfig(google),
      buildExportAssetPlan(buildPortableProjectExport(state)),
    );

    expect(issues.some((issue) => issue.code === 'asset.clicktag-channel-materialization-required')).toBe(true);
  });

  it('errors when clickTag channels lose clickTag bootstrap in index.html', () => {
    const state = createInitialState();
    state.document.metadata.release.targetChannel = 'gam-html5';
    const bundle = buildExportBundle(state);
    const brokenBundle = {
      ...bundle,
      files: bundle.files.map((file) =>
        file.path === 'index.html' && file.content
          ? { ...file, content: file.content.replace('window.clickTag = window.clickTag ||', 'window.__removedClickTag =') }
          : file,
      ),
    };
    const gam = buildGamHtml5Adapter(state);

    const issues = validateExportPackage(
      brokenBundle,
      buildExportPackagingPlan(gam),
      buildExportExitConfig(gam),
      buildExportAssetPlan(buildPortableProjectExport(state)),
    );

    expect(issues.some((issue) => issue.code === 'exit.clicktag-bootstrap-missing')).toBe(true);
  });

  it('flags when remote assets are localized but the package omits remote-fetch-plan.json', () => {
    const state = createInitialState();
    const sceneId = state.document.scenes[0].id;
    state.document.metadata.release.targetChannel = 'gam-html5';
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

    const bundle = buildExportBundle(state);
    const brokenBundle = {
      ...bundle,
      files: bundle.files.filter((file) => file.path !== 'remote-fetch-plan.json'),
    };
    const gam = buildGamHtml5Adapter(state);
    const assetPlan = buildExportAssetPlan(buildPortableProjectExport(state));
    const localizedAdapter = { ...gam, portableProject: buildLocalizedPortableProject(gam.portableProject, assetPlan) };
    const issues = validateExportPackage(brokenBundle, buildExportPackagingPlan(localizedAdapter), buildExportExitConfig(localizedAdapter), assetPlan);

    expect(issues.some((issue) => issue.code === 'asset.missing-remote-fetch-plan')).toBe(true);
  });

  it('warns when clickTag channels exceed the channel size budget', () => {
    const state = createInitialState();
    state.document.metadata.release.targetChannel = 'gam-html5';
    const oversizedBundle = {
      channel: 'gam-html5' as const,
      files: [
        { path: 'index.html', mime: 'text/html;charset=utf-8', content: '<html></html>' },
        { path: 'runtime.js', mime: 'text/javascript;charset=utf-8', content: 'console.log("runtime")' },
        { path: 'package-metrics.json', mime: 'application/json;charset=utf-8', content: '{}' },
        { path: 'remote-fetch-plan.json', mime: 'application/json;charset=utf-8', content: '[]' },
        { path: 'hero.bin', mime: 'application/octet-stream', bytes: new Uint8Array(220 * 1024) },
      ],
    };
    const gam = buildGamHtml5Adapter(state);

    const issues = validateExportPackage(
      oversizedBundle,
      buildExportPackagingPlan(gam),
      buildExportExitConfig(gam),
      [],
    );

    expect(issues.some((issue) => issue.code === 'bundle.channel-size-warning')).toBe(true);
  });
});
