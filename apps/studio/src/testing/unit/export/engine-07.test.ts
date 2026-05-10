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
          ? { ...file, content: file.content.replace('window.ClickTag = window.ClickTag ||', 'window.__removedClickTag =') }
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
        { path: 'hero.bin', mime: 'application/octet-stream', bytes: new Uint8Array(320 * 1024) },
      ],
    };
    const gam = buildGamHtml5Adapter(state);

    const issues = validateExportPackage(
      oversizedBundle,
      buildExportPackagingPlan(gam),
      buildExportExitConfig(gam),
      [],
    );

    expect(issues.some((issue) => issue.code === 'bundle.iab-total-size-warning')).toBe(true);
  });

  it('renders playable exports without external runtime and supports inlined assets', () => {
    const state = createInitialState();
    const sceneId = state.document.scenes[0].id;
    state.document.metadata.release.targetChannel = 'meta-story';
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

    const playable = buildPlayableExportAdapter(state);
    const html = buildChannelHtml(state, playable);
    const inlineHtml = buildPlayableSingleFileHtml(state, playable, {
      'https://cdn.example.com/hero.png': 'data:image/png;base64,AAAA',
    });

    expect(html).toContain('data-adapter="playable-ad"');
    expect(inlineHtml).toContain('data:image/png;base64,AAAA');
    expect(inlineHtml).not.toContain('<script src="./runtime.js"></script>');
  });

  it('includes MRAID custom close and version diagnostics in exported html', () => {
    const state = createInitialState();
    state.document.canvas.width = 320;
    state.document.canvas.height = 480;
    state.document.metadata.release.targetChannel = 'mraid';

    const html = buildChannelHtml(state, buildMraidAdapter(state));

    expect(html).toContain('window.mraid.useCustomClose(true);');
    expect(html).toContain('Host reports MRAID v');
  });

  it('builds VAST SIMID html and xml artifacts', () => {
    const state = createInitialState();
    state.document.metadata.release.targetChannel = 'vast-simid';

    const adapter = buildVastSimidAdapter(state);
    const html = buildChannelHtml(state, adapter);
    const xml = buildVastSimidXml(adapter);

    expect(adapter.adapter).toBe('vast-simid');
    expect(html).toContain('data-adapter="vast-simid"');
    expect(xml).toContain('<InteractiveCreativeFile');
    expect(xml).toContain('apiFramework="SIMID"');
  });

  it('warns when initial load exceeds the IAB initial budget', () => {
    const state = createInitialState();
    state.document.metadata.release.targetChannel = 'gam-html5';
    const bundle = {
      channel: 'gam-html5' as const,
      files: [
        { path: 'index.html', mime: 'text/html;charset=utf-8', content: 'x'.repeat(100 * 1024) },
        { path: 'runtime.js', mime: 'text/javascript;charset=utf-8', content: 'y'.repeat(70 * 1024) },
        { path: 'remote-fetch-plan.json', mime: 'application/json;charset=utf-8', content: '[]' },
      ],
    };

    const issues = validateExportPackage(
      bundle,
      buildExportPackagingPlan(buildGamHtml5Adapter(state)),
      buildExportExitConfig(buildGamHtml5Adapter(state)),
      [],
    );

    expect(issues.some((issue) => issue.code === 'bundle.iab-initial-load-warning')).toBe(true);
  });

  it('does not warn on initial IAB load when html and js stay within budget', () => {
    const state = createInitialState();
    state.document.metadata.release.targetChannel = 'gam-html5';
    const bundle = {
      channel: 'gam-html5' as const,
      files: [
        { path: 'index.html', mime: 'text/html;charset=utf-8', content: 'x'.repeat(60 * 1024) },
        { path: 'runtime.js', mime: 'text/javascript;charset=utf-8', content: 'y'.repeat(60 * 1024) },
        { path: 'remote-fetch-plan.json', mime: 'application/json;charset=utf-8', content: '[]' },
      ],
    };

    const issues = validateExportPackage(
      bundle,
      buildExportPackagingPlan(buildGamHtml5Adapter(state)),
      buildExportExitConfig(buildGamHtml5Adapter(state)),
      [],
    );

    expect(issues.some((issue) => issue.code === 'bundle.iab-initial-load-warning')).toBe(false);
  });

  it('uses an empty string instead of example.com when no clickthrough exists', () => {
    const state = createInitialState();
    state.document.metadata.release.targetChannel = 'gam-html5';

    const html = buildChannelHtml(state, buildGamHtml5Adapter(state));

    expect(html).not.toContain('https://example.com');
    expect(html).toContain('window.ClickTag = window.ClickTag || window.clickTag || ""');
  });
});
