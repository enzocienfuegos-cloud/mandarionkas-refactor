/** @vitest-environment jsdom */
import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RenderContext } from '../../../canvas/stage/render-context';
import type { WidgetNode } from '../../../domain/document/types';
import { renderDropZoneStage } from '../../../widgets/modules/drop-zone.renderer';
import * as tokenDragRuntime from '../../../widgets/modules/token-drag-runtime';

function createDropZone(): WidgetNode {
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
    },
    style: {},
    timeline: { startMs: 0, endMs: 15000 },
  };
}

function createContext(): RenderContext {
  return {
    previewMode: true,
    isReproducing: true,
    playheadMs: 0,
    sceneDurationMs: 15000,
    hovered: false,
    active: false,
    widgetsById: {
      pool_1: {
        id: 'pool_1',
        type: 'drag-token-pool',
        name: 'Tokens',
        sceneId: 'scene_1',
        zIndex: 1,
        frame: { x: 0, y: 0, width: 280, height: 96, rotation: 0 },
        props: {
          tokens: [{ id: 'tok_1', label: 'Token 1', targetSceneId: 'scene_2' }],
          disabledIds: [],
          dropTargetId: 'drop_1',
          tokenSize: 72,
          gap: 16,
          tokenShape: 'circle',
        },
        style: {},
        timeline: { startMs: 0, endMs: 15000 },
      },
    },
    triggerWidgetAction: vi.fn(),
    goToScene: vi.fn(),
    executeAction: vi.fn(),
  };
}

describe('drop zone stable subscription', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not resubscribe to token drag runtime when ctx identity changes', () => {
    const subscribeSpy = vi.spyOn(tokenDragRuntime, 'subscribeTokenDrag');
    const node = createDropZone();
    const ctx1 = createContext();
    const ctx2 = { ...createContext() };

    const { rerender } = render(renderDropZoneStage(node, ctx1));
    const callsAfterFirstMount = subscribeSpy.mock.calls.length;

    rerender(renderDropZoneStage(node, ctx2));

    expect(subscribeSpy.mock.calls.length).toBe(callsAfterFirstMount);
  });
});
