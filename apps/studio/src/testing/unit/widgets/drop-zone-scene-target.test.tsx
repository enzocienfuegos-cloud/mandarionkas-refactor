/** @vitest-environment jsdom */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RenderContext } from '../../../canvas/stage/render-context';
import type { WidgetNode } from '../../../domain/document/types';
import { renderDragTokenPoolStage } from '../../../widgets/modules/drag-token-pool.renderer';
import { renderDropZoneStage } from '../../../widgets/modules/drop-zone.renderer';
import { emitTokenDrag } from '../../../widgets/modules/token-drag-runtime';

function createDropZone(id = 'drop_1', props: Partial<WidgetNode['props']> = {}): WidgetNode {
  return {
    id,
    type: 'drop-zone',
    name: 'Drop zone',
    sceneId: 'scene_1',
    zIndex: 2,
    frame: { x: 0, y: 0, width: 120, height: 120, rotation: 0 },
    props: {
      width: 120,
      height: 120,
      hitPadding: 16,
      debugOutline: true,
      matchActionMap: '{}',
      ...props,
    },
    style: {},
    timeline: { startMs: 0, endMs: 15000 },
  };
}

function createTokenPool(tokens: Array<Record<string, unknown>>, props: Partial<WidgetNode['props']> = {}): WidgetNode {
  return {
    id: 'pool_1',
    type: 'drag-token-pool',
    name: 'Tokens',
    sceneId: 'scene_1',
    zIndex: 1,
    frame: { x: 0, y: 0, width: 280, height: 96, rotation: 0 },
    props: {
      tokens,
      disabledIds: [],
      dropTargetId: 'drop_1',
      tokenSize: 72,
      gap: 16,
      tokenShape: 'circle',
      ...props,
    },
    style: {},
    timeline: { startMs: 0, endMs: 15000 },
  };
}

function mockDropZoneRect(container: HTMLElement): void {
  const shell = Array.from(container.children).at(-1) as HTMLDivElement | undefined;
  const zone = shell?.firstElementChild as HTMLDivElement | null;
  expect(zone).toBeTruthy();

  Object.defineProperty(zone!, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({
      left: 0,
      top: 0,
      right: 160,
      bottom: 160,
      width: 160,
      height: 160,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }),
  });
}

function createContext(widgetsById: Record<string, WidgetNode>, overrides: Partial<RenderContext> = {}): RenderContext {
  return {
    previewMode: true,
    isReproducing: true,
    playheadMs: 0,
    sceneDurationMs: 15000,
    hovered: false,
    active: false,
    widgetsById,
    triggerWidgetAction: vi.fn(),
    executeAction: vi.fn(),
    goToScene: vi.fn(),
    ...overrides,
  };
}

describe('drop zone scene targeting', () => {
  const rafCallbacks: FrameRequestCallback[] = [];

  beforeEach(() => {
    rafCallbacks.length = 0;
    vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
      rafCallbacks.push(callback);
      return rafCallbacks.length;
    }));
    vi.stubGlobal('cancelAnimationFrame', vi.fn((id: number) => {
      if (id <= 0) return;
      rafCallbacks[id - 1] = () => undefined;
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('routes a dropped token directly to its configured target scene', () => {
    const tokenPool = createTokenPool([{ id: 'tok_1', label: 'Token 1', targetSceneId: 'scene_2' }]);
    const goToScene = vi.fn();
    const executeAction = vi.fn();
    const ctx = createContext(
      {
        [tokenPool.id]: tokenPool,
      },
      { goToScene, executeAction },
    );

    const { container } = render(renderDropZoneStage(createDropZone(), ctx));
    const shell = container.firstElementChild as HTMLDivElement | null;
    const zone = shell?.firstElementChild as HTMLDivElement | null;
    expect(zone).toBeTruthy();

    Object.defineProperty(zone!, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({
        left: 0,
        top: 0,
        right: 160,
        bottom: 160,
        width: 160,
        height: 160,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }),
    });

    act(() => {
      emitTokenDrag({
        phase: 'end',
        tokenId: 'tok_1',
        sourceWidgetId: tokenPool.id,
        clientX: 80,
        clientY: 80,
      });
    });

    expect(goToScene).toHaveBeenCalledWith('scene_2');
    expect(executeAction).not.toHaveBeenCalled();
  });

  it('routes a dropped token when the token pool still stores legacy JSON string tokens', () => {
    const tokenPool = createTokenPool([], {
      tokens: JSON.stringify([{ id: 'tok_legacy', label: 'Legacy token', targetSceneId: 'scene_legacy_next' }]),
    });
    const goToScene = vi.fn();
    const executeAction = vi.fn();
    const ctx = createContext(
      {
        [tokenPool.id]: tokenPool,
      },
      { goToScene, executeAction },
    );

    const { container } = render(renderDropZoneStage(createDropZone(), ctx));
    mockDropZoneRect(container);

    act(() => {
      emitTokenDrag({
        phase: 'end',
        tokenId: 'tok_legacy',
        sourceWidgetId: tokenPool.id,
        clientX: 80,
        clientY: 80,
      });
    });

    expect(goToScene).toHaveBeenCalledWith('scene_legacy_next');
    expect(executeAction).not.toHaveBeenCalled();
  });

  it('uses the drag event token target even if the source pool is no longer in the current scene context', () => {
    const goToScene = vi.fn();
    const executeAction = vi.fn();
    const ctx = createContext({}, { goToScene, executeAction });

    const { container } = render(renderDropZoneStage(createDropZone(), ctx));
    mockDropZoneRect(container);

    act(() => {
      emitTokenDrag({
        phase: 'end',
        tokenId: 'tok_snapshot',
        sourceWidgetId: 'pool_from_previous_render',
        dropTargetId: 'drop_1',
        targetSceneId: 'scene_from_event',
        clientX: 80,
        clientY: 80,
      });
    });

    expect(goToScene).toHaveBeenCalledWith('scene_from_event');
    expect(executeAction).not.toHaveBeenCalled();
  });

  it('prefers the current source widget config over stale drag event target snapshots', () => {
    const tokenPool = createTokenPool([{ id: 'tok_current', label: 'Current token', targetActionId: 'act_current_drop' }]);
    const goToScene = vi.fn();
    const executeAction = vi.fn();
    const ctx = createContext(
      {
        [tokenPool.id]: tokenPool,
      },
      { goToScene, executeAction },
    );

    const { container } = render(renderDropZoneStage(createDropZone('drop_1'), ctx));
    mockDropZoneRect(container);

    act(() => {
      emitTokenDrag({
        phase: 'end',
        tokenId: 'tok_current',
        sourceWidgetId: tokenPool.id,
        dropTargetId: 'drop_stale',
        targetSceneId: 'scene_stale',
        clientX: 80,
        clientY: 80,
      });
    });

    expect(executeAction).toHaveBeenCalledWith('act_current_drop');
    expect(goToScene).not.toHaveBeenCalled();
  });

  it('allows the current source widget link to recover from a stale drag event drop target snapshot', () => {
    const tokenPool = createTokenPool([{ id: 'tok_relinked', label: 'Relinked token', targetSceneId: 'scene_current' }]);
    const goToScene = vi.fn();
    const executeAction = vi.fn();
    const ctx = createContext(
      {
        [tokenPool.id]: tokenPool,
      },
      { goToScene, executeAction },
    );

    const { container } = render(renderDropZoneStage(createDropZone('drop_1'), ctx));
    mockDropZoneRect(container);

    act(() => {
      emitTokenDrag({
        phase: 'end',
        tokenId: 'tok_relinked',
        sourceWidgetId: tokenPool.id,
        dropTargetId: 'drop_stale',
        clientX: 80,
        clientY: 80,
      });
    });

    expect(goToScene).toHaveBeenCalledWith('scene_current');
    expect(executeAction).not.toHaveBeenCalled();
  });

  it('ignores drops when the source token pool is linked to a different drop zone', () => {
    const tokenPool = createTokenPool([{ id: 'tok_3', label: 'Token 3', targetSceneId: 'scene_4' }]);
    const goToScene = vi.fn();
    const executeAction = vi.fn();
    const ctx = createContext(
      {
        [tokenPool.id]: createTokenPool([{ id: 'tok_3', label: 'Token 3', targetSceneId: 'scene_4' }], { dropTargetId: 'drop_other' }),
      },
      { goToScene, executeAction },
    );

    const { container } = render(renderDropZoneStage(createDropZone('drop_1'), ctx));
    const shell = container.firstElementChild as HTMLDivElement | null;
    const zone = shell?.firstElementChild as HTMLDivElement | null;
    expect(zone).toBeTruthy();

    Object.defineProperty(zone!, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({
        left: 0,
        top: 0,
        right: 160,
        bottom: 160,
        width: 160,
        height: 160,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }),
    });

    act(() => {
      emitTokenDrag({
        phase: 'end',
        tokenId: 'tok_3',
        sourceWidgetId: tokenPool.id,
        clientX: 80,
        clientY: 80,
      });
    });

    expect(goToScene).not.toHaveBeenCalled();
    expect(executeAction).not.toHaveBeenCalled();
  });

  it('executes a configured widget action for the dropped token before any fallback action map', () => {
    const tokenPool = createTokenPool([{ id: 'tok_2', label: 'Token 2', targetActionId: 'act_show_layer' }]);
    const goToScene = vi.fn();
    const executeAction = vi.fn();
    const ctx = createContext(
      {
        [tokenPool.id]: tokenPool,
      },
      { goToScene, executeAction },
    );

    const { container } = render(renderDropZoneStage(createDropZone('drop_1', {
      matchActionMap: JSON.stringify({ tok_2: 'act_fallback' }),
    }), ctx));
    const shell = container.firstElementChild as HTMLDivElement | null;
    const zone = shell?.firstElementChild as HTMLDivElement | null;
    expect(zone).toBeTruthy();

    Object.defineProperty(zone!, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({
        left: 0,
        top: 0,
        right: 160,
        bottom: 160,
        width: 160,
        height: 160,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }),
    });

    act(() => {
      emitTokenDrag({
        phase: 'end',
        tokenId: 'tok_2',
        sourceWidgetId: tokenPool.id,
        clientX: 80,
        clientY: 80,
      });
    });

    expect(executeAction).toHaveBeenCalledWith('act_show_layer');
    expect(goToScene).not.toHaveBeenCalled();
    expect(executeAction).not.toHaveBeenCalledWith('act_fallback');
  });

  it('keeps drop-zone match action maps working from the real drag token renderer payload', () => {
    const tokenPool = createTokenPool([{ id: 'tok_fallback', label: 'Fallback token' }]);
    const goToScene = vi.fn();
    const executeAction = vi.fn();
    const ctx = createContext(
      {
        [tokenPool.id]: tokenPool,
      },
      { goToScene, executeAction },
    );

    const { container } = render(
      <>
        {renderDragTokenPoolStage(tokenPool, ctx)}
        {renderDropZoneStage(createDropZone('drop_1', {
          matchActionMap: JSON.stringify({ tok_fallback: 'act_fallback_drop' }),
        }), ctx)}
      </>,
    );
    mockDropZoneRect(container);

    act(() => {
      fireEvent.pointerDown(screen.getByText('Fallback token'), { pointerId: 1, clientX: 20, clientY: 30, isPrimary: true });
    });
    act(() => {
      fireEvent.pointerMove(window, { pointerId: 1, clientX: 80, clientY: 80 });
    });
    act(() => {
      rafCallbacks.shift()?.(16);
    });
    act(() => {
      fireEvent.pointerUp(window, { pointerId: 1, clientX: 80, clientY: 80 });
    });

    expect(executeAction).toHaveBeenCalledWith('act_fallback_drop');
    expect(goToScene).not.toHaveBeenCalled();
  });

  it('keeps legacy onMatchAction working from the real drag token renderer payload', () => {
    const tokenPool = createTokenPool([{ id: 'tok_legacy_action', label: 'Legacy action token' }], {
      dropTargetId: '',
    });
    const goToScene = vi.fn();
    const executeAction = vi.fn();
    const ctx = createContext(
      {
        [tokenPool.id]: tokenPool,
      },
      { goToScene, executeAction },
    );

    const { container } = render(
      <>
        {renderDragTokenPoolStage(tokenPool, ctx)}
        {renderDropZoneStage(createDropZone('drop_1', {
          matchActionMap: '{}',
          onMatchAction: 'act_legacy_drop',
        }), ctx)}
      </>,
    );
    mockDropZoneRect(container);

    act(() => {
      fireEvent.pointerDown(screen.getByText('Legacy action token'), { pointerId: 1, clientX: 20, clientY: 30, isPrimary: true });
    });
    act(() => {
      fireEvent.pointerMove(window, { pointerId: 1, clientX: 80, clientY: 80 });
    });
    act(() => {
      rafCallbacks.shift()?.(16);
    });
    act(() => {
      fireEvent.pointerUp(window, { pointerId: 1, clientX: 80, clientY: 80 });
    });

    expect(executeAction).toHaveBeenCalledWith('act_legacy_drop');
    expect(goToScene).not.toHaveBeenCalled();
  });
});
