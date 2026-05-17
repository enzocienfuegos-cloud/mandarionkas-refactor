// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createInitialState, createScene } from '../../domain/document/factories';
import type { WidgetMotion, WidgetNode } from '../../domain/document/types';
import { buildChannelHtml, buildGenericHtml5Adapter, compileRuntime } from '../../export/engine';

function mountExportHtml(html: string): void {
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  document.head.innerHTML = parsed.head.innerHTML;
  document.body.innerHTML = parsed.body.innerHTML;
}

describe('animation engine e2e', () => {
  afterEach(() => {
    document.head.innerHTML = '';
    document.body.innerHTML = '';
    delete (window as typeof window & { SmxRuntime?: unknown }).SmxRuntime;
    delete (window as typeof window & { smxRuntime?: unknown }).smxRuntime;
    vi.useRealTimers();
  });

  it('boots the compiled runtime bundle and waits for scene-exit before swapping scenes', () => {
    vi.useFakeTimers();
    const state = createInitialState();
    const sourceScene = { ...state.document.scenes[0] };
    const targetScene = { ...createScene(1, 'Scene 2'), order: 1 };
    const exitMotion: WidgetMotion = {
      exit: {
        templateId: 'fade-out',
        trigger: 'scene-exit',
        config: { delayMs: 60, durationMs: 240 },
      },
    };
    const sourceWidget: WidgetNode = {
      id: 'source_text',
      type: 'text',
      name: 'Scene 1 text',
      sceneId: sourceScene.id,
      zIndex: 1,
      frame: { x: 24, y: 24, width: 180, height: 40, rotation: 0 },
      props: { text: 'Scene 1' },
      style: { color: '#111111' },
      motion: exitMotion,
      timeline: { startMs: 0, endMs: 1500 },
    };
    const targetWidget: WidgetNode = {
      id: 'target_text',
      type: 'text',
      name: 'Scene 2 text',
      sceneId: targetScene.id,
      zIndex: 1,
      frame: { x: 24, y: 24, width: 180, height: 40, rotation: 0 },
      props: { text: 'Scene 2' },
      style: { color: '#111111' },
      timeline: { startMs: 0, endMs: 1500 },
    };

    state.document.widgets.source_text = sourceWidget;
    state.document.widgets.target_text = targetWidget;

    sourceScene.widgetIds = ['source_text'];
    targetScene.widgetIds = ['target_text'];
    state.document.scenes = [sourceScene, targetScene];
    state.document.selection.activeSceneId = sourceScene.id;

    const adapter = buildGenericHtml5Adapter(state);
    mountExportHtml(buildChannelHtml(state, adapter));
    window.eval(compileRuntime(adapter.portableProject, adapter));

    const firstSceneNode = document.querySelector<HTMLElement>(`[data-scene-id="${sourceScene.id}"]`);
    const secondSceneNode = document.querySelector<HTMLElement>(`[data-scene-id="${targetScene.id}"]`);

    expect(window.SmxRuntime?.bootSmxRuntime).toBeTypeOf('function');
    expect(firstSceneNode?.style.display).toBe('block');
    expect(secondSceneNode?.style.display).toBe('none');
    expect(document.body.textContent).toContain('Scene 1');

    (window as typeof window & { smxRuntime?: { nextScene?: () => void } }).smxRuntime?.nextScene?.();

    expect(firstSceneNode?.style.display).toBe('block');
    expect(secondSceneNode?.style.display).toBe('none');

    vi.advanceTimersByTime(299);
    expect(firstSceneNode?.style.display).toBe('block');
    expect(secondSceneNode?.style.display).toBe('none');

    vi.advanceTimersByTime(1);
    expect(firstSceneNode?.style.display).toBe('none');
    expect(secondSceneNode?.style.display).toBe('block');
    expect(document.body.textContent).toContain('Scene 2');
  });
});
