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
});
