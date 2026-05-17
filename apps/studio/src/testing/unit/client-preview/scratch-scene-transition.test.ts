// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mountScratchReveal } from '../../../export/runtime/scratch';
import {
  createEngineStub,
  createRuntimeModel,
  createRuntimeScene,
  createRuntimeWidget,
  createSceneManagerStub,
  dispatchScratchPointerEvent,
  installScratchCanvasMock,
  mountScratchDom,
} from './scratch-runtime-test-helpers';

describe('scratch reveal target scene', () => {
  let restoreCanvasMock: (() => void) | null = null;

  beforeEach(() => {
    vi.useFakeTimers();
    restoreCanvasMock = installScratchCanvasMock();
    document.body.innerHTML = '';
  });

  afterEach(() => {
    vi.useRealTimers();
    restoreCanvasMock?.();
    restoreCanvasMock = null;
    document.body.innerHTML = '';
  });

  it('calls sceneManager.showScene with target scene index on complete', () => {
    const sceneManager = createSceneManagerStub({
      findSceneIndexById: vi.fn(() => 2),
      showScene: vi.fn(),
    });
    const runtimeModel = createRuntimeModel(
      createRuntimeScene({
        id: 'scene_1',
        name: 'Scene 1',
        order: 0,
        durationMs: 2000,
        widgets: [
          createRuntimeWidget({
            id: 'scratch_group',
            type: 'group',
            sceneId: 'scene_1',
            zIndex: 5,
            props: {
              scratchEnabled: true,
              revealTargetMode: 'scene',
              revealTargetId: 'scene_3',
            },
          }),
        ],
      }),
    );
    const { shell } = mountScratchDom({
      'data-scratch-auto-reveal-threshold': '20',
      'data-scratch-reveal-target-mode': 'scene',
      'data-scratch-reveal-target-id': 'scene_3',
    });

    const handle = mountScratchReveal(createEngineStub(), runtimeModel, sceneManager);

    dispatchScratchPointerEvent(shell, 'pointerdown', 10, 10);
    dispatchScratchPointerEvent(shell, 'pointermove', 30, 10);
    vi.advanceTimersByTime(60);

    expect(sceneManager.findSceneIndexById).toHaveBeenCalledWith('scene_3');
    expect(sceneManager.showScene).toHaveBeenCalledWith(2);

    handle.dispose();
  });

  it('does not call showScene when target scene id is invalid', () => {
    const sceneManager = createSceneManagerStub({
      findSceneIndexById: vi.fn(() => -1),
      showScene: vi.fn(),
    });
    const runtimeModel = createRuntimeModel(
      createRuntimeScene({
        id: 'scene_1',
        name: 'Scene 1',
        order: 0,
        durationMs: 2000,
        widgets: [
          createRuntimeWidget({
            id: 'scratch_group',
            type: 'group',
            sceneId: 'scene_1',
            zIndex: 5,
            props: {
              scratchEnabled: true,
              revealTargetMode: 'scene',
              revealTargetId: 'missing-scene',
            },
          }),
        ],
      }),
    );
    const { shell } = mountScratchDom({
      'data-scratch-auto-reveal-threshold': '20',
      'data-scratch-reveal-target-mode': 'scene',
      'data-scratch-reveal-target-id': 'missing-scene',
    });

    const handle = mountScratchReveal(createEngineStub(), runtimeModel, sceneManager);

    dispatchScratchPointerEvent(shell, 'pointerdown', 10, 10);
    dispatchScratchPointerEvent(shell, 'pointermove', 30, 10);
    vi.advanceTimersByTime(60);

    expect(sceneManager.findSceneIndexById).toHaveBeenCalledWith('missing-scene');
    expect(sceneManager.showScene).not.toHaveBeenCalled();

    handle.dispose();
  });
});
