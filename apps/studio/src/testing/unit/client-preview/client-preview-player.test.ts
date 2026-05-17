import { describe, expect, it } from 'vitest';
import { createInitialState } from '../../../domain/document/factories';
import { buildClientPreviewSceneHtml, buildClientPreviewSceneState } from '../../../features/client-preview/ClientPreviewPlayer';

describe('client preview player', () => {
  it('renders public preview through the export runtime so compositor motion uses WAAPI', () => {
    const state = createInitialState();
    const sceneId = state.document.scenes[0].id;
    state.document.metadata.release.targetChannel = 'generic-html5';
    state.document.widgets.float_1 = {
      id: 'float_1',
      type: 'text',
      name: 'Floating headline',
      sceneId,
      zIndex: 1,
      frame: { x: 24, y: 40, width: 180, height: 44, rotation: 0 },
      style: { color: '#ffffff', fontSize: 24, fontWeight: 800 },
      props: { text: 'Smooth motion' },
      motion: {
        templateId: 'float',
        config: { durationMs: 1600, distancePx: 12, repeatMode: 'loop' },
      },
      timeline: { startMs: 0, endMs: 1000 },
    } as any;
    state.document.scenes[0].widgetIds.push('float_1');

    const html = buildClientPreviewSceneHtml(state, 0);

    expect(html).toContain('initCompositorMotion');
    expect(html).toContain('node.animate(spec.keyframes');
    expect(html).toContain('&quot;compositorMotion&quot;');
    expect(html).toContain('Smooth motion');
  });

  it('isolates the selected scene for public preview playback', () => {
    const state = createInitialState();
    state.document.scenes.push({
      id: 'scene_2',
      name: 'Scene 2',
      order: 1,
      widgetIds: [],
      durationMs: 2000,
    });

    const previewState = buildClientPreviewSceneState(state, 1);

    expect(previewState.document.scenes).toHaveLength(1);
    expect(previewState.document.scenes[0]?.id).toBe('scene_2');
    expect(previewState.ui.previewMode).toBe(true);
    expect(previewState.ui.isPlaying).toBe(true);
  });
});
