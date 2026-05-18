/** @vitest-environment jsdom */
import { act, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RenderContext } from '../../../canvas/stage/render-context';
import type { WidgetNode } from '../../../domain/document/types';
import { renderDropZoneStage } from '../../../widgets/modules/drop-zone.renderer';
import { emitTokenDrag } from '../../../widgets/modules/token-drag-runtime';

function createDropZone(props: Partial<WidgetNode['props']> = {}): WidgetNode {
  return {
    id: 'drop_1',
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

function createTokenPool(tokens: Array<Record<string, unknown>>): WidgetNode {
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
    },
    style: {},
    timeline: { startMs: 0, endMs: 15000 },
  };
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
  afterEach(() => {
    vi.restoreAllMocks();
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

  it('falls back to the legacy action map when the token has no target scene', () => {
    const tokenPool = createTokenPool([{ id: 'tok_2', label: 'Token 2' }]);
    const goToScene = vi.fn();
    const executeAction = vi.fn();
    const ctx = createContext(
      {
        [tokenPool.id]: tokenPool,
      },
      { goToScene, executeAction },
    );

    const { container } = render(
      renderDropZoneStage(
        createDropZone({ matchActionMap: JSON.stringify({ tok_2: 'act_scene_3' }) }),
        ctx,
      ),
    );
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

    expect(goToScene).not.toHaveBeenCalled();
    expect(executeAction).toHaveBeenCalledWith('act_scene_3');
  });
});
