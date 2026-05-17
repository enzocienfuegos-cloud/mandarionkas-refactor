import { describe, expect, it } from 'vitest';
import { createInitialState } from '../../../domain/document/factories';
import { buildExportRuntimeModelFromPortable, buildGamHtml5Adapter, buildMraidAdapter, compileRuntime, buildExportPreflight } from '../../../export/engine';

describe('runtime tree shake', () => {
  const getByteLength = (value: string) => new TextEncoder().encode(value).length;

  it('ships a compiled runtime bundle for minimal image + cta exports', () => {
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

    expect(script).toContain('window.SmxRuntime.bootSmxRuntime(');
    expect(script).toContain('showScene(0)');
    expect(script).not.toContain('new Function(');
    expect(getByteLength(script)).toBeGreaterThan(100 * 1024);
    expect(getByteLength(script)).toBeLessThan(250 * 1024);
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

    expect(script).toContain('"type":"dynamic-map"');
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

    expect(script).toContain('"type":"form"');
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

    expect(script).toContain('__smxScratchCompletionMsByWidgetId');
    expect(script).toContain('data-scratch-widget-id');
    expect(script).toContain('webkitMaskImage');
  });

  it('defers compositor motion behind a scratch group until the reveal completes', () => {
    const state = createInitialState();
    const sceneId = state.document.scenes[0].id;
    state.document.metadata.release.targetChannel = 'gam-html5';
    state.document.widgets.image_1 = {
      id: 'image_1',
      type: 'image',
      name: 'Reveal target',
      sceneId,
      zIndex: 1,
      frame: { x: 10, y: 10, width: 180, height: 120, rotation: 0 },
      style: { opacity: 1 },
      motion: {
        templateId: 'float',
        config: { durationMs: 2200, delayMs: 0, distancePx: 14 },
      },
      props: { src: 'https://cdn.example.com/reveal.png', alt: 'Reveal target' },
      timeline: { startMs: 0, endMs: 1000, keyframes: [] },
    } as any;
    state.document.widgets.group_1 = {
      id: 'group_1',
      type: 'group',
      name: 'Scratch group',
      sceneId,
      zIndex: 4,
      frame: { x: 0, y: 0, width: 220, height: 160, rotation: 0 },
      style: {},
      props: { title: 'Scratch group', scratchEnabled: true, beforeImage: 'https://cdn.example.com/cover.png' },
      timeline: { startMs: 0, endMs: 1000 },
      childIds: [],
    } as any;
    state.document.scenes[0].widgetIds.push('image_1', 'group_1');

    const adapter = buildGamHtml5Adapter(state);
    const script = compileRuntime(adapter.portableProject, adapter);

    expect(script).toContain('window.__smxScratchCompletionMsByWidgetId');
    expect(script).toContain('"templateId":"float"');
  });

  it('replays selected scratch target group motion on descendant layers after reveal', () => {
    const state = createInitialState();
    const sceneId = state.document.scenes[0].id;
    state.document.metadata.release.targetChannel = 'gam-html5';
    state.document.widgets.target_group = {
      id: 'target_group',
      type: 'group',
      name: 'Target group',
      sceneId,
      zIndex: 1,
      frame: { x: 0, y: 0, width: 220, height: 160, rotation: 0 },
      style: {},
      props: { title: 'Target group' },
      motion: {
        templateId: 'slide-in-left',
        config: { durationMs: 700, delayMs: 0, distancePx: 90 },
      },
      timeline: { startMs: 0, endMs: 1000, keyframes: [] },
      childIds: ['image_1'],
    } as any;
    state.document.widgets.image_1 = {
      id: 'image_1',
      type: 'image',
      name: 'Grouped child',
      sceneId,
      parentId: 'target_group',
      zIndex: 2,
      frame: { x: 24, y: 24, width: 120, height: 90, rotation: 0 },
      style: { opacity: 1 },
      props: { src: 'https://cdn.example.com/grouped.png', alt: 'Grouped child' },
      timeline: { startMs: 0, endMs: 1000, keyframes: [] },
    } as any;
    state.document.widgets.group_1 = {
      id: 'group_1',
      type: 'group',
      name: 'Scratch group',
      sceneId,
      zIndex: 4,
      frame: { x: 0, y: 0, width: 220, height: 160, rotation: 0 },
      style: {},
      props: {
        title: 'Scratch group',
        scratchEnabled: true,
        revealTargetMode: 'widget',
        revealTargetId: 'target_group',
        beforeImage: 'https://cdn.example.com/cover.png',
      },
      timeline: { startMs: 0, endMs: 1000 },
      childIds: [],
    } as any;
    state.document.scenes[0].widgetIds.push('target_group', 'image_1', 'group_1');

    const adapter = buildGamHtml5Adapter(state);
    const script = compileRuntime(adapter.portableProject, adapter);

    expect(script).toContain('smxInitCompositorMotion');
    expect(script).toContain('"revealTargetId":"target_group"');
  });

  it('restarts timeline-keyframed targets behind a scratch group from reveal time', () => {
    const state = createInitialState();
    const sceneId = state.document.scenes[0].id;
    state.document.metadata.release.targetChannel = 'gam-html5';
    state.document.widgets.image_1 = {
      id: 'image_1',
      type: 'image',
      name: 'Slide target',
      sceneId,
      zIndex: 1,
      frame: { x: 10, y: 10, width: 180, height: 120, rotation: 0 },
      style: { opacity: 1 },
      props: { src: 'https://cdn.example.com/reveal.png', alt: 'Slide target' },
      timeline: {
        startMs: 0,
        endMs: 1000,
        keyframes: [
          { id: 'kf_1', property: 'x', atMs: 0, value: -180, easing: 'linear' },
          { id: 'kf_2', property: 'x', atMs: 1000, value: 10, easing: 'ease-out' },
        ],
      },
    } as any;
    state.document.widgets.group_1 = {
      id: 'group_1',
      type: 'group',
      name: 'Scratch group',
      sceneId,
      zIndex: 4,
      frame: { x: 0, y: 0, width: 220, height: 160, rotation: 0 },
      style: {},
      props: {
        title: 'Scratch group',
        scratchEnabled: true,
        revealTargetMode: 'widget',
        revealTargetId: 'image_1',
        beforeImage: 'https://cdn.example.com/cover.png',
      },
      timeline: { startMs: 0, endMs: 1000 },
      childIds: [],
    } as any;
    state.document.scenes[0].widgetIds.push('image_1', 'group_1');

    const adapter = buildGamHtml5Adapter(state);
    const script = compileRuntime(adapter.portableProject, adapter);

    expect(script).toContain('__smxScratchCompletionPerfMsByWidgetId');
    expect(script).toContain('"property":"x"');
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

    expect(script).toContain('"property":"opacity"');
    expect(script).toContain('window.SmxRuntime.bootSmxRuntime(');
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

    expect(script).toContain('"hoverMotionPreset":"lift"');
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

    expect(script).toContain('"hoverMotion":{"templateId":"lift"');
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

    expect(exportedWidget?.timeline.keyframes).toEqual([]);
    expect(script).toContain('window.SmxRuntime.bootSmxRuntime(');
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

    expect(exportedWidget?.timeline.keyframes).toEqual([]);
    expect(script).toContain('window.SmxRuntime.bootSmxRuntime(');
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

    expect(exportedWidget?.timeline.keyframes).toEqual([]);
    expect(runtimeWidget?.compositorMotion?.keyframes[1]?.transform).toBe('translate3d(0, -14px, 0)');
    expect(runtimeWidget?.compositorMotion?.options.iterations).toBe('infinite');
    expect(script).toContain('window.SmxRuntime.bootSmxRuntime(');
    expect(script).toContain('data-widget-layer-id');
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
    expect(script).toContain('window.SmxRuntime.bootSmxRuntime(');
    expect(script).toContain('"type":"dynamic-map"');
    expect(script).toContain('"type":"form"');
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
