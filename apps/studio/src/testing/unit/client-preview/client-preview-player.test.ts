import { describe, expect, it } from 'vitest';
import { createInitialState } from '../../../domain/document/factories';
import { buildClientPreviewSceneHtml, buildClientPreviewSceneState } from '../../../features/client-preview/ClientPreviewPlayer';

describe('client preview player', () => {
  it('renders public preview through the compiled export runtime bundle', () => {
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

    expect(html).toContain('window.SmxRuntime.bootSmxRuntime(');
    expect(html).toContain('"motion":{"idle":{"templateId":"float"');
    expect(html).toContain('Smooth motion');
  });

  it('serializes public preview runtime JSON as parseable script text', () => {
    const state = createInitialState();
    const sceneId = state.document.scenes[0].id;
    state.document.widgets.text_1 = {
      id: 'text_1',
      type: 'text',
      name: 'JSON check',
      sceneId,
      zIndex: 1,
      frame: { x: 24, y: 40, width: 180, height: 44, rotation: 0 },
      style: { color: '#ffffff', fontSize: 24, fontWeight: 800 },
      props: { text: 'JSON <safe> & parseable' },
      timeline: { startMs: 0, endMs: 1000 },
    } as any;
    state.document.scenes[0].widgetIds.push('text_1');

    const html = buildClientPreviewSceneHtml(state, 0);
    const extractJsonScript = (id: string) => {
      const marker = `id="${id}">`;
      const start = html.indexOf(marker);
      if (start < 0) return undefined;
      const contentStart = start + marker.length;
      const end = html.indexOf('</script>', contentStart);
      return end >= 0 ? html.slice(contentStart, end) : undefined;
    };
    const runtimeJson = extractJsonScript('smx-runtime-model');
    const exitJson = extractJsonScript('smx-exit-config');

    expect(runtimeJson).toBeTruthy();
    expect(exitJson).toBeTruthy();
    expect(runtimeJson).not.toContain('&quot;');
    expect(exitJson).not.toContain('&quot;');
    expect(() => JSON.parse(runtimeJson ?? '')).not.toThrow();
    expect(() => JSON.parse(exitJson ?? '')).not.toThrow();
    expect(html).toContain('window.SmxRuntime.bootSmxRuntime(');
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
