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

  it('builds portable exports from the resolved active variant and shared-layer scene overrides', () => {
    let state = createInitialState({ canvasPresetId: 'wide-skyscraper' });
    const firstSceneId = state.document.scenes[0].id;
    state.document.widgets.text_1 = {
      id: 'text_1',
      type: 'text',
      name: 'Headline',
      sceneId: firstSceneId,
      zIndex: 1,
      frame: { x: 20, y: 24, width: 180, height: 44, rotation: 0 },
      style: { color: '#ffffff' },
      props: { text: 'Master headline' },
      timeline: { startMs: 0, endMs: 1000 },
    } as any;
    state.document.scenes[0].widgetIds.push('text_1');
    state = documentSceneReducer(state, { type: 'ADD_SCENE' });
    const secondSceneId = state.document.scenes[1].id;
    state = documentSceneReducer(state, { type: 'ADD_CANVAS_VARIANT', presetId: 'medium-rectangle' });
    const variantId = state.document.activeCanvasVariantId;
    state.document.widgetOverrides[variantId] = {
      text_1: {
        frame: { x: 44, width: 140 },
      },
    };
    state = {
      ...state,
      document: {
        ...state.document,
        selection: {
          ...state.document.selection,
          activeSceneId: firstSceneId,
          widgetIds: ['text_1'],
          primaryWidgetId: 'text_1',
        },
      },
    };
    state = reduceBySlices(state, { type: 'CONVERT_WIDGET_TO_SHARED_LAYER', widgetId: 'text_1' });
    const sharedLayer = Object.values(state.document.sharedLayers)[0];
    const sceneTwoWidgetId = sharedLayer?.sceneWidgetIds[secondSceneId] ?? '';
    state = {
      ...state,
      document: {
        ...state.document,
        selection: {
          ...state.document.selection,
          activeSceneId: secondSceneId,
          widgetIds: [sceneTwoWidgetId],
          primaryWidgetId: sceneTwoWidgetId,
        },
      },
    };
    state = reduceBySlices(state, { type: 'UPDATE_WIDGET_PROPS', widgetId: sceneTwoWidgetId, patch: { text: 'Scene two headline' } });

    const portable = buildPortableProjectExport(state);
    const sceneOneWidget = portable.scenes.find((scene) => scene.id === firstSceneId)?.widgets.find((widget) => widget.id === 'text_1');
    const sceneTwoWidget = portable.scenes.find((scene) => scene.id === secondSceneId)?.widgets.find((widget) => widget.id === sceneTwoWidgetId);

    expect(portable.canvas.width).toBe(300);
    expect(portable.canvas.height).toBe(250);
    expect(sceneOneWidget?.frame.x).toBe(44);
    expect(sceneOneWidget?.frame.width).toBe(140);
    expect(sceneOneWidget?.props.text).toBe('Master headline');
    expect(sceneTwoWidget?.frame.x).toBe(44);
    expect(sceneTwoWidget?.props.text).toBe('Scene two headline');
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
});
