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

  it('reveals only the configured target subtree after completion in widget mode', () => {
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
            id: 'target_group',
            type: 'group',
            sceneId: 'scene_1',
            zIndex: 1,
            frame: { x: 0, y: 0, width: 200, height: 100, rotation: 0 },
            childIds: ['target_card_1', 'target_card_2'],
          }),
          createRuntimeWidget({
            id: 'target_card_1',
            type: 'image',
            sceneId: 'scene_1',
            parentId: 'target_group',
            zIndex: 2,
            frame: { x: 10, y: 10, width: 60, height: 40, rotation: 0 },
          }),
          createRuntimeWidget({
            id: 'target_card_2',
            type: 'image',
            sceneId: 'scene_1',
            parentId: 'target_group',
            zIndex: 3,
            frame: { x: 90, y: 10, width: 60, height: 40, rotation: 0 },
          }),
          createRuntimeWidget({
            id: 'other_card',
            type: 'image',
            sceneId: 'scene_1',
            zIndex: 0,
            frame: { x: 30, y: 60, width: 90, height: 20, rotation: 0 },
          }),
          createRuntimeWidget({
            id: 'cover_text',
            type: 'text',
            sceneId: 'scene_1',
            parentId: 'scratch_group',
            zIndex: 6,
            frame: { x: 20, y: 20, width: 120, height: 30, rotation: 0 },
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
              revealTargetId: 'target_group',
            },
            childIds: ['cover_text'],
          }),
        ],
      }),
    );

    document.body.innerHTML = `
      <div data-widget-id="scratch_group">
        <div data-scratch>
          <div data-scratch-reveal></div>
          <div data-scratch-cover><canvas data-scratch-canvas></canvas></div>
          <div data-scratch-hit-area></div>
        </div>
      </div>
      <div data-widget-id="cover_text"></div>
      <div data-widget-layer-id="cover_text"></div>
      <div data-widget-id="target_group"></div>
      <div data-widget-layer-id="target_group"></div>
      <div data-widget-id="target_card_1"></div>
      <div data-widget-layer-id="target_card_1"></div>
      <div data-widget-id="target_card_2"></div>
      <div data-widget-layer-id="target_card_2"></div>
      <div data-widget-id="other_card"></div>
      <div data-widget-layer-id="other_card"></div>
    `;
    const shell = document.querySelector<HTMLElement>('[data-scratch]');
    const canvas = document.querySelector<HTMLCanvasElement>('[data-scratch-canvas]');
    if (!shell || !canvas) throw new Error('scratch DOM did not mount');
    shell.setAttribute('data-scratch-auto-reveal-threshold', '20');
    shell.setAttribute('data-scratch-reveal-target-mode', 'widget');
    shell.setAttribute('data-scratch-reveal-target-id', 'target_group');
    shell.setAttribute('data-scratch-radius', '24');
    shell.getBoundingClientRect = () => ({
      x: 0,
      y: 0,
      width: 200,
      height: 100,
      top: 0,
      left: 0,
      right: 200,
      bottom: 100,
      toJSON: () => ({}),
    } as DOMRect);
    Object.defineProperty(shell, 'clientWidth', { configurable: true, value: 200 });
    Object.defineProperty(shell, 'clientHeight', { configurable: true, value: 100 });
    Object.defineProperty(shell, 'offsetWidth', { configurable: true, value: 200 });
    Object.defineProperty(shell, 'offsetHeight', { configurable: true, value: 100 });

    const handle = mountScratchReveal(engine, runtimeModel, sceneManager);

    expect((document.querySelector('[data-widget-id="cover_text"]') as HTMLElement).style.display).toBe('none');
    expect((document.querySelector('[data-widget-id="target_group"]') as HTMLElement).style.display).toBe('');
    expect((document.querySelector('[data-widget-id="target_card_1"]') as HTMLElement).style.display).toBe('');
    expect((document.querySelector('[data-widget-id="target_card_2"]') as HTMLElement).style.display).toBe('');
    expect((document.querySelector('[data-widget-id="other_card"]') as HTMLElement).style.display).toBe('none');

    dispatchScratchPointerEvent(shell, 'pointerdown', 10, 10);
    dispatchScratchPointerEvent(shell, 'pointermove', 40, 10);

    expect(shell.classList.contains('is-scratch-complete')).toBe(true);
    expect(canvas.style.display).toBe('none');
    expect((document.querySelector('[data-widget-id="scratch_group"]') as HTMLElement).style.display).toBe('none');
    expect((document.querySelector('[data-widget-id="cover_text"]') as HTMLElement).style.display).toBe('none');
    expect((document.querySelector('[data-widget-id="target_group"]') as HTMLElement).style.display).toBe('');
    expect((document.querySelector('[data-widget-id="target_card_1"]') as HTMLElement).style.display).toBe('');
    expect((document.querySelector('[data-widget-id="target_card_2"]') as HTMLElement).style.display).toBe('');
    expect((document.querySelector('[data-widget-id="other_card"]') as HTMLElement).style.display).toBe('none');

    handle.dispose();
  });

  it('keeps live internal targets mounted behind the Canvas cover for progressive reveal', () => {
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
            id: 'cover_group',
            type: 'group',
            sceneId: 'scene_1',
            parentId: 'scratch_group',
            zIndex: 6,
            childIds: ['target_group', 'cover_text'],
            frame: { x: 10, y: 10, width: 180, height: 100, rotation: 0 },
          }),
          createRuntimeWidget({
            id: 'target_group',
            type: 'group',
            sceneId: 'scene_1',
            parentId: 'cover_group',
            zIndex: 1,
            childIds: ['target_card_1'],
            frame: { x: 18, y: 14, width: 120, height: 80, rotation: 0 },
          }),
          createRuntimeWidget({
            id: 'target_card_1',
            type: 'image',
            sceneId: 'scene_1',
            parentId: 'target_group',
            zIndex: 2,
            frame: { x: 12, y: 18, width: 80, height: 60, rotation: 0 },
          }),
          createRuntimeWidget({
            id: 'cover_text',
            type: 'text',
            sceneId: 'scene_1',
            parentId: 'cover_group',
            zIndex: 7,
            frame: { x: 20, y: 20, width: 120, height: 30, rotation: 0 },
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
              revealTargetId: 'target_group',
            },
            childIds: ['cover_group'],
          }),
        ],
      }),
    );

    document.body.innerHTML = `
      <div data-widget-id="scratch_group">
        <div data-scratch-target-content></div>
        <div data-scratch>
          <div data-scratch-reveal></div>
          <div data-scratch-cover><canvas data-scratch-canvas></canvas></div>
          <div data-scratch-hit-area></div>
        </div>
      </div>
      <div data-widget-id="cover_group"></div>
      <div data-widget-layer-id="cover_group"></div>
      <div data-widget-id="target_group"></div>
      <div data-widget-layer-id="target_group"></div>
      <div data-widget-id="target_card_1"></div>
      <div data-widget-layer-id="target_card_1"></div>
      <div data-widget-id="cover_text"></div>
      <div data-widget-layer-id="cover_text"></div>
    `;

    const shell = document.querySelector<HTMLElement>('[data-scratch]');
    const canvas = document.querySelector<HTMLCanvasElement>('[data-scratch-canvas]');
    if (!shell || !canvas) throw new Error('scratch DOM did not mount');
    shell.setAttribute('data-scratch-auto-reveal-threshold', '1');
    shell.setAttribute('data-scratch-reveal-target-mode', 'widget');
    shell.setAttribute('data-scratch-reveal-target-id', 'target_group');
    shell.setAttribute('data-scratch-radius', '24');
    shell.getBoundingClientRect = () => ({
      x: 0,
      y: 0,
      width: 200,
      height: 100,
      top: 0,
      left: 0,
      right: 200,
      bottom: 100,
      toJSON: () => ({}),
    } as DOMRect);
    Object.defineProperty(shell, 'clientWidth', { configurable: true, value: 200 });
    Object.defineProperty(shell, 'clientHeight', { configurable: true, value: 100 });
    Object.defineProperty(shell, 'offsetWidth', { configurable: true, value: 200 });
    Object.defineProperty(shell, 'offsetHeight', { configurable: true, value: 100 });

    const handle = mountScratchReveal(engine, runtimeModel, sceneManager);

    expect((document.querySelector('[data-widget-id="cover_group"]') as HTMLElement).style.display).toBe('');
    expect((document.querySelector('[data-widget-id="target_group"]') as HTMLElement).style.display).toBe('');
    expect((document.querySelector('[data-widget-id="target_card_1"]') as HTMLElement).style.display).toBe('');
    expect((document.querySelector('[data-widget-id="cover_text"]') as HTMLElement).style.display).toBe('none');

    dispatchScratchPointerEvent(shell, 'pointerdown', 10, 10);
    dispatchScratchPointerEvent(shell, 'pointermove', 50, 30);

    expect(shell.classList.contains('is-scratch-complete')).toBe(true);
    expect((document.querySelector('[data-widget-id="scratch_group"]') as HTMLElement).style.display).toBe('none');
    expect((document.querySelector('[data-widget-id="cover_group"]') as HTMLElement).style.display).toBe('');
    expect((document.querySelector('[data-widget-id="target_group"]') as HTMLElement).style.display).toBe('');
    expect((document.querySelector('[data-widget-id="target_card_1"]') as HTMLElement).style.display).toBe('');

    handle.dispose();
  });
});
