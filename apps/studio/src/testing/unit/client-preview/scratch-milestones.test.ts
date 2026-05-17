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

describe('scratch milestones', () => {
  let restoreCanvasMock: (() => void) | null = null;

  beforeEach(() => {
    restoreCanvasMock = installScratchCanvasMock();
    document.body.innerHTML = '';
  });

  afterEach(() => {
    restoreCanvasMock?.();
    restoreCanvasMock = null;
    document.body.innerHTML = '';
  });

  it('emits trigger at 25% but does not complete until threshold', () => {
    const engine = createEngineStub();
    const sceneManager = createSceneManagerStub();
    const runtimeModel = createRuntimeModel(
      createRuntimeScene({
        id: 'scene_1',
        name: 'Scene 1',
        order: 0,
        durationMs: 2000,
        widgets: [
          createRuntimeWidget({
            id: 'target_widget',
            type: 'image',
            sceneId: 'scene_1',
            zIndex: 1,
            frame: { x: 0, y: 0, width: 150, height: 90, rotation: 0 },
          }),
          createRuntimeWidget({
            id: 'scratch_group',
            type: 'group',
            sceneId: 'scene_1',
            zIndex: 5,
            frame: { x: 0, y: 0, width: 200, height: 100, rotation: 0 },
            props: {
              scratchEnabled: true,
              revealTargetMode: 'widget',
              revealTargetId: 'target_widget',
            },
          }),
        ],
      }),
    );
    const { shell, canvas } = mountScratchDom({
      'data-scratch-auto-reveal-threshold': '80',
      'data-scratch-milestones': JSON.stringify([{ id: 'm1', thresholdPercent: 25, emitTrigger: 'reveal' }]),
      'data-scratch-reveal-target-mode': 'widget',
      'data-scratch-reveal-target-id': 'target_widget',
    });

    const handle = mountScratchReveal(engine, runtimeModel, sceneManager);

    dispatchScratchPointerEvent(shell, 'pointerdown', 10, 10);
    dispatchScratchPointerEvent(shell, 'pointermove', 30, 10);

    expect(engine.emit).toHaveBeenCalledTimes(1);
    expect(engine.emit).toHaveBeenCalledWith(expect.objectContaining({
      trigger: 'reveal',
      sourceId: 'scratch_group',
      targetId: 'target_widget',
    }));
    expect(shell.classList.contains('is-scratch-complete')).toBe(false);
    expect(canvas.style.display).not.toBe('none');

    handle.dispose();
  });

  it('does not re-emit same milestone twice', () => {
    const engine = createEngineStub();
    const runtimeModel = createRuntimeModel(
      createRuntimeScene({
        id: 'scene_1',
        name: 'Scene 1',
        order: 0,
        durationMs: 2000,
        widgets: [
          createRuntimeWidget({
            id: 'target_widget',
            type: 'image',
            sceneId: 'scene_1',
            zIndex: 1,
          }),
          createRuntimeWidget({
            id: 'scratch_group',
            type: 'group',
            sceneId: 'scene_1',
            zIndex: 5,
            props: {
              scratchEnabled: true,
              revealTargetMode: 'widget',
              revealTargetId: 'target_widget',
            },
          }),
        ],
      }),
    );
    const { shell } = mountScratchDom({
      'data-scratch-auto-reveal-threshold': '95',
      'data-scratch-milestones': JSON.stringify([{ id: 'm1', thresholdPercent: 25, emitTrigger: 'reveal' }]),
      'data-scratch-reveal-target-mode': 'widget',
      'data-scratch-reveal-target-id': 'target_widget',
    });

    const handle = mountScratchReveal(engine, runtimeModel, createSceneManagerStub());

    dispatchScratchPointerEvent(shell, 'pointerdown', 10, 10);
    dispatchScratchPointerEvent(shell, 'pointermove', 30, 10);
    dispatchScratchPointerEvent(shell, 'pointermove', 60, 10);

    const revealCalls = (engine.emit as ReturnType<typeof vi.fn>).mock.calls
      .map(([event]) => event)
      .filter((event) => event.trigger === 'reveal');
    expect(revealCalls).toHaveLength(1);

    handle.dispose();
  });

  it('emits milestones in ascending order on single fast scratch', () => {
    const engine = createEngineStub();
    const runtimeModel = createRuntimeModel(
      createRuntimeScene({
        id: 'scene_1',
        name: 'Scene 1',
        order: 0,
        durationMs: 2000,
        widgets: [
          createRuntimeWidget({
            id: 'target_widget',
            type: 'image',
            sceneId: 'scene_1',
            zIndex: 1,
          }),
          createRuntimeWidget({
            id: 'scratch_group',
            type: 'group',
            sceneId: 'scene_1',
            zIndex: 5,
            props: {
              scratchEnabled: true,
              revealTargetMode: 'widget',
              revealTargetId: 'target_widget',
            },
          }),
        ],
      }),
    );
    const { shell } = mountScratchDom({
      'data-scratch-auto-reveal-threshold': '99',
      'data-scratch-milestones': JSON.stringify([
        { id: 'm75', thresholdPercent: 75, emitTrigger: 'game-state' },
        { id: 'm25', thresholdPercent: 25, emitTrigger: 'reveal' },
        { id: 'm50', thresholdPercent: 50, emitTrigger: 'completion' },
      ]),
      'data-scratch-reveal-target-mode': 'widget',
      'data-scratch-reveal-target-id': 'target_widget',
    });

    const handle = mountScratchReveal(engine, runtimeModel, createSceneManagerStub());

    dispatchScratchPointerEvent(shell, 'pointerdown', 10, 10);
    dispatchScratchPointerEvent(shell, 'pointermove', 30, 10);
    dispatchScratchPointerEvent(shell, 'pointermove', 60, 10);
    dispatchScratchPointerEvent(shell, 'pointermove', 90, 10);
    dispatchScratchPointerEvent(shell, 'pointermove', 120, 10);

    const triggers = (engine.emit as ReturnType<typeof vi.fn>).mock.calls.map(([event]) => event.trigger);
    expect(triggers).toEqual(['reveal', 'completion', 'game-state']);

    handle.dispose();
  });
});
