import { describe, expect, it } from 'vitest';
import { createInitialState } from '../../../domain/document/factories';
import { buildExportRuntimeModelFromPortable, buildGamHtml5Adapter, buildMraidAdapter, compileRuntime, buildExportPreflight } from '../../../export/engine';

describe('runtime tree shake', () => {
  const getByteLength = (value: string) => new TextEncoder().encode(value).length;

  it('keeps minimal image + cta exports free of map runtime and under 4KB', () => {
    const state = createInitialState();
    const sceneId = state.document.scenes[0].id;
    state.document.metadata.release.targetChannel = 'gam-html5';
    state.document.widgets.image_1 = {
      id: 'image_1',
      type: 'image',
      name: 'Hero',
      sceneId,
      zIndex: 1,
      frame: { x: 0, y: 0, width: 300, height: 160, rotation: 0 },
      style: {},
      props: { src: 'https://cdn.example.com/hero.png', alt: 'Hero' },
      timeline: { startMs: 0, endMs: 1000 },
    } as any;
    state.document.widgets.cta_1 = {
      id: 'cta_1',
      type: 'cta',
      name: 'CTA',
      sceneId,
      zIndex: 2,
      frame: { x: 24, y: 180, width: 160, height: 44, rotation: 0 },
      style: {},
      props: { text: 'Shop now', url: 'https://example.com' },
      timeline: { startMs: 0, endMs: 1000 },
    } as any;
    state.document.scenes[0].widgetIds.push('image_1', 'cta_1');

    const adapter = buildGamHtml5Adapter(state);
    const script = compileRuntime(adapter.portableProject, adapter);

    expect(script).not.toContain('leaflet');
    expect(script).not.toContain('L.map');
    expect(script).not.toContain('renderMapCards');
    expect(script).not.toContain('updateCarousel');
    expect(script).toContain('showScene(0)');
    expect(getByteLength(script)).toBeLessThan(4 * 1024);
  });

  it('includes the map runtime when a map widget exists', () => {
    const state = createInitialState();
    const sceneId = state.document.scenes[0].id;
    state.document.metadata.release.targetChannel = 'gam-html5';
    state.document.widgets.map_1 = {
      id: 'map_1',
      type: 'dynamic-map',
      name: 'Map',
      sceneId,
      zIndex: 1,
      frame: { x: 0, y: 0, width: 300, height: 180, rotation: 0 },
      style: {},
      props: { title: 'Nearby locations' },
      timeline: { startMs: 0, endMs: 1000 },
    } as any;
    state.document.scenes[0].widgetIds.push('map_1');

    const adapter = buildGamHtml5Adapter(state);
    const script = compileRuntime(adapter.portableProject, adapter);

    expect(script).toContain('renderMapCards');
    expect(script).toContain('map-place-cta');
  });

  it('includes the interactive runtime when a form widget exists', () => {
    const state = createInitialState();
    const sceneId = state.document.scenes[0].id;
    state.document.metadata.release.targetChannel = 'gam-html5';
    state.document.widgets.form_1 = {
      id: 'form_1',
      type: 'form',
      name: 'Lead form',
      sceneId,
      zIndex: 1,
      frame: { x: 0, y: 0, width: 300, height: 180, rotation: 0 },
      style: {},
      props: { title: 'Lead form' },
      timeline: { startMs: 0, endMs: 1000 },
    } as any;
    state.document.scenes[0].widgetIds.push('form_1');

    const adapter = buildGamHtml5Adapter(state);
    const script = compileRuntime(adapter.portableProject, adapter);

    expect(script).toContain('widget-form');
    expect(script).toContain('Submitting…');
  });

  it('includes the scratch runtime when a scratch-enabled group exists', () => {
    const state = createInitialState();
    const sceneId = state.document.scenes[0].id;
    state.document.metadata.release.targetChannel = 'gam-html5';
    state.document.widgets.group_1 = {
      id: 'group_1',
      type: 'group',
      name: 'Scratch group',
      sceneId,
      zIndex: 3,
      frame: { x: 0, y: 0, width: 220, height: 160, rotation: 0 },
      style: {},
      props: { title: 'Scratch group', scratchEnabled: true, beforeImage: 'https://cdn.example.com/cover.png' },
      timeline: { startMs: 0, endMs: 1000 },
      childIds: [],
    } as any;
    state.document.scenes[0].widgetIds.push('group_1');

    const adapter = buildGamHtml5Adapter(state);
    const script = compileRuntime(adapter.portableProject, adapter);

    expect(script).toContain('initScratchReveal');
    expect(script).toContain('data-scratch-canvas');
    expect(script).toContain('ctx.ellipse(');
    expect(script).toContain('cleared += (255 - pixels[index]) / 255');
    expect(script).toContain('eraseScratchStroke');
    expect(script).toContain('completeThreshold > 0 && progress >= completeThreshold');
    expect(script).toContain("node.getAttribute('data-scratch-cover-motion-id')");
    expect(script).toContain("shell.querySelectorAll('[data-scratch-cover-motion-id]')");
  });

  it('includes the timeline runtime only when widgets define keyframes', () => {
    const state = createInitialState();
    const sceneId = state.document.scenes[0].id;
    state.document.metadata.release.targetChannel = 'gam-html5';
    state.document.widgets.image_1 = {
      id: 'image_1',
      type: 'image',
      name: 'Hero',
      sceneId,
      zIndex: 1,
      frame: { x: 0, y: 0, width: 300, height: 160, rotation: 0 },
      style: { opacity: 1 },
      props: { src: 'https://cdn.example.com/hero.png', alt: 'Hero' },
      timeline: {
        startMs: 0,
        endMs: 1000,
        keyframes: [
          { id: 'kf_1', property: 'opacity', atMs: 0, value: 0, easing: 'linear' },
          { id: 'kf_2', property: 'opacity', atMs: 1000, value: 1, easing: 'ease-out' },
        ],
      },
    } as any;
    state.document.scenes[0].widgetIds.push('image_1');

    const adapter = buildGamHtml5Adapter(state);
    const script = compileRuntime(adapter.portableProject, adapter);

    expect(script).toContain('startWidgetTimelineLoop');
    expect(script).toContain('getWidgetTrackValue');
    expect(script).toContain('patchedShowScene');
    expect(script).toContain('data-scratch-cover-widget-id');
  });

  it('includes hover motion runtime only when widgets opt into hover motion presets', () => {
    const state = createInitialState();
    const sceneId = state.document.scenes[0].id;
    state.document.metadata.release.targetChannel = 'gam-html5';
    state.document.widgets.image_1 = {
      id: 'image_1',
      type: 'image',
      name: 'Hero',
      sceneId,
      zIndex: 1,
      frame: { x: 0, y: 0, width: 300, height: 160, rotation: 0 },
      style: { hoverMotionPreset: 'lift', hoverMotionDurationMs: 320, hoverMotionDistancePx: 14, hoverMotionScale: 1.06 },
      props: { src: 'https://cdn.example.com/hero.png', alt: 'Hero' },
      timeline: { startMs: 0, endMs: 1000 },
    } as any;
    state.document.scenes[0].widgetIds.push('image_1');

    const adapter = buildGamHtml5Adapter(state);
    const script = compileRuntime(adapter.portableProject, adapter);

    expect(script).toContain('applyRuntimeHoverMotion');
    expect(script).toContain('smx-runtime-hover-pulse');
  });

  it('includes hover motion runtime when widgets opt into formal hoverMotion config', () => {
    const state = createInitialState();
    const sceneId = state.document.scenes[0].id;
    state.document.metadata.release.targetChannel = 'gam-html5';
    state.document.widgets.image_1 = {
      id: 'image_1',
      type: 'image',
      name: 'Hero',
      sceneId,
      zIndex: 1,
      frame: { x: 0, y: 0, width: 300, height: 160, rotation: 0 },
      style: {},
      hoverMotion: {
        templateId: 'lift',
        config: { durationMs: 320, distancePx: 14, scale: 1.06 },
      },
      props: { src: 'https://cdn.example.com/hero.png', alt: 'Hero' },
      timeline: { startMs: 0, endMs: 1000 },
    } as any;
    state.document.scenes[0].widgetIds.push('image_1');

    const adapter = buildGamHtml5Adapter(state);
    const script = compileRuntime(adapter.portableProject, adapter);

    expect(script).toContain('applyRuntimeHoverMotion');
    expect(script).toContain('smx-runtime-hover-pulse');
  });

  it('normalizes template-backed motion into scrub keyframes and compositor runtime', () => {
    const state = createInitialState();
    const sceneId = state.document.scenes[0].id;
    state.document.metadata.release.targetChannel = 'gam-html5';
    state.document.widgets.cta_1 = {
      id: 'cta_1',
      type: 'cta',
      name: 'CTA',
      sceneId,
      zIndex: 1,
      frame: { x: 24, y: 180, width: 160, height: 44, rotation: 0 },
      style: { animationPreset: 'appear', animationDurationMs: 700, animationRepeatMode: 'once', opacity: 1 },
      props: { text: 'Shop now', url: 'https://example.com' },
      timeline: { startMs: 0, endMs: 1000, keyframes: [] },
    } as any;
    state.document.scenes[0].widgetIds.push('cta_1');

    const adapter = buildGamHtml5Adapter(state);
    const script = compileRuntime(adapter.portableProject, adapter);
    const exportedWidget = adapter.portableProject.scenes[0]?.widgets.find((widget) => widget.id === 'cta_1');

    expect(exportedWidget?.timeline.keyframes?.length).toBeGreaterThan(0);
    expect(script).toContain('initCompositorMotion');
    expect(script).not.toContain('startWidgetTimelineLoop');
  });

  it('normalizes formal motion config into scrub keyframes and compositor runtime', () => {
    const state = createInitialState();
    const sceneId = state.document.scenes[0].id;
    state.document.metadata.release.targetChannel = 'gam-html5';
    state.document.widgets.cta_1 = {
      id: 'cta_1',
      type: 'cta',
      name: 'CTA',
      sceneId,
      zIndex: 1,
      frame: { x: 24, y: 180, width: 160, height: 44, rotation: 0 },
      style: { opacity: 1 },
      motion: {
        templateId: 'appear',
        config: { durationMs: 700, delayMs: 0, distancePx: 24, intensity: 0.55, repeatMode: 'once' },
      },
      props: { text: 'Shop now', url: 'https://example.com' },
      timeline: { startMs: 0, endMs: 1000, keyframes: [] },
    } as any;
    state.document.scenes[0].widgetIds.push('cta_1');

    const adapter = buildGamHtml5Adapter(state);
    const script = compileRuntime(adapter.portableProject, adapter);
    const exportedWidget = adapter.portableProject.scenes[0]?.widgets.find((widget) => widget.id === 'cta_1');

    expect(exportedWidget?.timeline.keyframes?.length).toBeGreaterThan(0);
    expect(script).toContain('initCompositorMotion');
    expect(script).not.toContain('startWidgetTimelineLoop');
  });

  it('serializes compositor-native motion while retaining scrub keyframes', () => {
    const state = createInitialState();
    const sceneId = state.document.scenes[0].id;
    state.document.metadata.release.targetChannel = 'gam-html5';
    state.document.widgets.image_1 = {
      id: 'image_1',
      type: 'image',
      name: 'Hero',
      sceneId,
      zIndex: 1,
      frame: { x: 0, y: 0, width: 300, height: 160, rotation: 0 },
      style: { opacity: 1 },
      motion: {
        templateId: 'float',
        config: { durationMs: 3600, delayMs: 100, distancePx: 14 },
      },
      props: { src: 'https://cdn.example.com/hero.png', alt: 'Hero' },
      timeline: { startMs: 0, endMs: 1000, keyframes: [] },
    } as any;
    state.document.scenes[0].widgetIds.push('image_1');

    const adapter = buildGamHtml5Adapter(state);
    const script = compileRuntime(adapter.portableProject, adapter);
    const exportedWidget = adapter.portableProject.scenes[0]?.widgets.find((widget) => widget.id === 'image_1');
    const runtimeModel = buildExportRuntimeModelFromPortable(adapter.portableProject);
    const runtimeWidget = runtimeModel.scenes[0]?.widgets.find((widget) => widget.id === 'image_1');

    expect(exportedWidget?.timeline.keyframes?.length).toBeGreaterThan(0);
    expect(runtimeWidget?.compositorMotion?.keyframes[1]?.transform).toBe('translate3d(0, -14px, 0)');
    expect(runtimeWidget?.compositorMotion?.options.iterations).toBe('infinite');
    expect(script).toContain('initCompositorMotion');
    expect(script).toContain('data-scratch-cover-motion-id');
    expect(script).toContain('data-widget-layer-id');
    expect(script).not.toContain('startWidgetTimelineLoop');
  });

  it('always includes environment scene management and keeps full runtime sections present when needed', () => {
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
      frame: { x: 0, y: 0, width: 300, height: 180, rotation: 0 },
      style: {},
      props: { title: 'Nearby locations', requestUserLocation: true },
      timeline: { startMs: 0, endMs: 1000 },
    } as any;
    state.document.widgets.form_1 = {
      id: 'form_1',
      type: 'form',
      name: 'Lead form',
      sceneId,
      zIndex: 2,
      frame: { x: 0, y: 190, width: 300, height: 180, rotation: 0 },
      style: {},
      props: { title: 'Lead form' },
      timeline: { startMs: 0, endMs: 1000 },
    } as any;
    state.document.scenes[0].widgetIds.push('map_1', 'form_1');

    const adapter = buildMraidAdapter(state);
    const script = compileRuntime(adapter.portableProject, adapter);

    expect(script).toContain('showScene(0)');
    expect(script).toContain('window.smxRuntime=');
    expect(script).toContain('renderMapCards');
    expect(script).toContain('widget-form');
    expect(getByteLength(script)).toBeGreaterThan(4 * 1024);
  });

  it('treats the mraid scene budget as a hard blocker', () => {
    const state = createInitialState();
    state.document.metadata.release.targetChannel = 'mraid';
    state.document.canvas.width = 320;
    state.document.canvas.height = 480;
    state.document.scenes.push({
      ...state.document.scenes[0],
      id: 'scene_2',
      name: 'Scene 2',
      order: 1,
      widgetIds: [],
    });
    state.document.scenes.push({
      ...state.document.scenes[0],
      id: 'scene_3',
      name: 'Scene 3',
      order: 2,
      widgetIds: [],
    });
    state.document.scenes.push({
      ...state.document.scenes[0],
      id: 'scene_4',
      name: 'Scene 4',
      order: 3,
      widgetIds: [],
    });

    const preflight = buildExportPreflight(state);

    expect(preflight.channelBlockers.some((item) => item.id === 'mraid-scene-budget')).toBe(true);
    expect(preflight.channelWarnings.some((item) => item.id === 'mraid-scene-budget')).toBe(false);
  });
});
