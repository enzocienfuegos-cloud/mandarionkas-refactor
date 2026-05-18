/** @vitest-environment jsdom */
import { Profiler } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RenderContext } from '../../../canvas/stage/render-context';
import type { WidgetNode } from '../../../domain/document/types';
import { renderDragTokenPoolStage } from '../../../widgets/modules/drag-token-pool.renderer';

function createNode(): WidgetNode {
  return {
    id: 'pool_1',
    type: 'drag-token-pool',
    name: 'Token Pool',
    sceneId: 'scene_1',
    zIndex: 1,
    frame: { x: 0, y: 0, width: 280, height: 96, rotation: 0 },
    props: {
      tokens: [{ id: 'tok_1', label: 'Token 1' }],
      disabledIds: [],
      dropTargetId: '',
      tokenSize: 72,
      gap: 16,
      tokenShape: 'circle',
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
    widgetsById: {},
    triggerWidgetAction: vi.fn(),
  };
}

describe('drag token pool ghost transform', () => {
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
    vi.unstubAllGlobals();
  });

  it('positions the drag ghost via translate3d and avoids re-renders during pointer moves', () => {
    let commitCount = 0;
    render(
      <Profiler id="drag-token-pool" onRender={() => { commitCount += 1; }}>
        {renderDragTokenPoolStage(createNode(), createContext())}
      </Profiler>,
    );

    const tokenLabel = screen.getByText('Token 1');
    act(() => {
      fireEvent.pointerDown(tokenLabel, { pointerId: 1, clientX: 20, clientY: 30, isPrimary: true });
    });

    const commitsAfterPointerDown = commitCount;
    const ghostNode = Array.from(document.body.querySelectorAll('div')).find((element) => element.textContent?.includes('Token 1') && element.style.zIndex === '9999') as HTMLDivElement | undefined;
    expect(ghostNode).toBeTruthy();
    expect(ghostNode?.style.transform).toContain('translate3d(20px, 30px, 0)');

    for (let index = 0; index < 10; index += 1) {
      act(() => {
        fireEvent.pointerMove(window, { pointerId: 1, clientX: 40 + index, clientY: 60 + index });
      });
      const callback = rafCallbacks.shift();
      expect(callback).toBeTruthy();
      act(() => {
        callback?.(16);
      });
    }

    expect(commitCount).toBe(commitsAfterPointerDown);
    expect(ghostNode?.style.transform).toContain('translate3d(49px, 69px, 0)');

    act(() => {
      fireEvent.pointerUp(window, { pointerId: 1, clientX: 49, clientY: 69 });
    });

    expect(Array.from(document.body.querySelectorAll('div')).some((element) => element === ghostNode)).toBe(false);
  });
});
