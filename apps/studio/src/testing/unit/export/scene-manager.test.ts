// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSceneManager } from '../../../export/runtime/scene-manager';
import type { AnimationEngine } from '../../../motion/animation-engine/engine';
import type { ExportRuntimeModel, ExportRuntimeScene, ExportRuntimeWidget } from '../../../export/runtime-model';

function createRuntimeWidget(overrides: Partial<ExportRuntimeWidget> & Pick<ExportRuntimeWidget, 'id' | 'type' | 'sceneId'>): ExportRuntimeWidget {
  return {
    id: overrides.id,
    type: overrides.type,
    sceneId: overrides.sceneId,
    zIndex: overrides.zIndex ?? 1,
    parentId: overrides.parentId,
    childIds: overrides.childIds,
    frame: overrides.frame ?? { x: 0, y: 0, width: 100, height: 60, rotation: 0 },
    props: overrides.props ?? {},
    style: overrides.style ?? {},
    motion: overrides.motion,
    hoverMotion: overrides.hoverMotion,
    compositorMotion: overrides.compositorMotion,
    timeline: overrides.timeline ?? { startMs: 0, endMs: 1500, keyframes: [] },
    hidden: overrides.hidden ?? false,
    interactive: overrides.interactive ?? false,
    gestures: overrides.gestures ?? [],
    actionIds: overrides.actionIds ?? [],
  };
}

function createRuntimeScene(overrides: Partial<ExportRuntimeScene> & Pick<ExportRuntimeScene, 'id' | 'name' | 'order' | 'durationMs' | 'widgets'>): ExportRuntimeScene {
  return {
    id: overrides.id,
    name: overrides.name,
    order: overrides.order,
    durationMs: overrides.durationMs,
    nextSceneId: overrides.nextSceneId,
    widgets: overrides.widgets,
  };
}

function createEngineStub(): AnimationEngine {
  return {
    buildPlansForWidget: () => [],
    play: () => {
      throw new Error('play() should not be called in scene manager test');
    },
    cancel: () => {},
    cancelAllForWidget: () => {},
    emit: () => {},
    subscribe: () => () => {},
    seekScene: () => {},
    pauseEventClocks: () => {},
    resumeEventClocks: () => {},
    resetEventClocks: () => {},
    getActivePlaybacks: () => [],
    hasFiredFor: () => false,
    dispose: () => {},
  };
}

describe('runtime scene manager', () => {
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('waits for configured scene-exit motion before hiding the previous scene', () => {
    vi.useFakeTimers();
    document.body.innerHTML = `
      <div data-scene-id="scene_1" style="display:block"></div>
      <div data-scene-id="scene_2" style="display:none"></div>
    `;

    const runtimeModel: ExportRuntimeModel = {
      version: 1,
      targetChannel: 'generic-html5',
      canvas: { width: 320, height: 480, backgroundColor: '#000000' },
      interactions: [],
      fontFaces: [],
      scenes: [
        createRuntimeScene({
          id: 'scene_1',
          name: 'Scene 1',
          order: 0,
          durationMs: 2000,
          widgets: [
            createRuntimeWidget({
              id: 'widget_1',
              type: 'text',
              sceneId: 'scene_1',
              motion: {
                exit: {
                  templateId: 'fade-out',
                  trigger: 'scene-exit',
                  config: { durationMs: 240, delayMs: 60 },
                },
              },
            }),
          ],
        }),
        createRuntimeScene({
          id: 'scene_2',
          name: 'Scene 2',
          order: 1,
          durationMs: 2000,
          widgets: [
            createRuntimeWidget({
              id: 'widget_2',
              type: 'text',
              sceneId: 'scene_2',
            }),
          ],
        }),
      ],
    };

    const sceneManager = createSceneManager({ runtimeModel, engine: createEngineStub() });
    const sceneOne = document.querySelector<HTMLElement>('[data-scene-id="scene_1"]');
    const sceneTwo = document.querySelector<HTMLElement>('[data-scene-id="scene_2"]');

    sceneManager.showScene(0);
    sceneManager.showScene(1);

    expect(sceneOne?.style.display).toBe('block');
    expect(sceneTwo?.style.display).toBe('none');

    vi.advanceTimersByTime(299);
    expect(sceneOne?.style.display).toBe('block');
    expect(sceneTwo?.style.display).toBe('none');

    vi.advanceTimersByTime(1);
    expect(sceneOne?.style.display).toBe('none');
    expect(sceneTwo?.style.display).toBe('block');

    sceneManager.dispose();
  });
});
