/** @vitest-environment jsdom */
import { fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WidgetNode } from '../../../domain/document/types';
import type { RenderContext } from '../../../canvas/stage/render-context';
import { renderGroupWidget } from '../../../widgets/group/group.renderer';

function createScratchGroup(options?: {
  autoRevealThresholdPercent?: number;
  width?: number;
  height?: number;
}): WidgetNode {
  return {
    id: 'scratch_group',
    type: 'group',
    name: 'Scratch group',
    sceneId: 'scene_1',
    zIndex: 3,
    frame: { x: 0, y: 0, width: options?.width ?? 320, height: options?.height ?? 180, rotation: 0 },
    style: {
      accentColor: '#8b5cf6',
      color: '#ffffff',
      borderRadius: 18,
      opacity: 1,
    },
    props: {
      title: 'Scratch group',
      scratchEnabled: true,
      scratchRadius: 24,
      autoRevealThresholdPercent: options?.autoRevealThresholdPercent ?? 0,
    },
    timeline: { startMs: 0, endMs: 1000 },
    childIds: [],
  };
}

function createScratchHarness(options?: {
  autoRevealThresholdPercent?: number;
  width?: number;
  height?: number;
  triggerWidgetAction?: RenderContext['triggerWidgetAction'];
}): JSX.Element {
  const node = createScratchGroup(options);
  const ctx = {
    sceneId: 'scene_1',
    widgetsById: { [node.id]: node },
    previewMode: true,
    isReproducing: false,
    playheadMs: 0,
    hovered: false,
    active: false,
    triggerWidgetAction: options?.triggerWidgetAction ?? vi.fn(),
  } as unknown as RenderContext;
  return renderGroupWidget(node, ctx);
}

describe('scratch pointer throughput', () => {
  let getContextSpy: ReturnType<typeof vi.spyOn>;
  let createObjectURLSpy: ReturnType<typeof vi.fn>;
  let revokeObjectURLSpy: ReturnType<typeof vi.fn>;
  let originalCreateObjectURL: typeof URL.createObjectURL;
  let originalRevokeObjectURL: typeof URL.revokeObjectURL;
  let originalResizeObserver: typeof ResizeObserver | undefined;
  let resizeObserverCallback: ResizeObserverCallback | null = null;
  let imageDataReads = 0;

  beforeEach(() => {
    imageDataReads = 0;
    originalCreateObjectURL = URL.createObjectURL;
    originalRevokeObjectURL = URL.revokeObjectURL;
    createObjectURLSpy = vi.fn(() => 'blob:mock');
    revokeObjectURLSpy = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, writable: true, value: createObjectURLSpy });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, writable: true, value: revokeObjectURLSpy });
    originalResizeObserver = globalThis.ResizeObserver;
    class MockResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        resizeObserverCallback = callback;
      }
      observe = vi.fn();
      disconnect = vi.fn();
      unobserve = vi.fn();
    }
    vi.stubGlobal('ResizeObserver', MockResizeObserver);

    const canvasContexts = new WeakMap<HTMLCanvasElement, CanvasRenderingContext2D>();
    getContextSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function getContext(type: string) {
      if (type !== '2d') return null;
      let context = canvasContexts.get(this);
      if (!context) {
        const contextLike = {
          canvas: this,
          clearRect: vi.fn(),
          fillRect: vi.fn(),
          save: vi.fn(),
          restore: vi.fn(),
          beginPath: vi.fn(),
          moveTo: vi.fn(),
          lineTo: vi.fn(),
          stroke: vi.fn(),
          arc: vi.fn(),
          fill: vi.fn(),
          ellipse: vi.fn(),
          getImageData: vi.fn(() => {
            imageDataReads += 1;
            const total = Math.max(4, this.width * this.height * 4);
            const data = new Uint8ClampedArray(total);
            data.fill(255);
            if (imageDataReads >= 4) {
              for (let index = 3; index < data.length; index += 4) data[index] = 0;
            }
            return { data };
          }),
          set fillStyle(_value: string) {},
          set globalCompositeOperation(_value: string) {},
          set lineCap(_value: string) {},
          set lineJoin(_value: string) {},
          set lineWidth(_value: number) {},
        } as unknown as CanvasRenderingContext2D;
        context = contextLike;
        canvasContexts.set(this, context);
      }
      return context;
    });
  });

  afterEach(() => {
    getContextSpy.mockRestore();
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, writable: true, value: originalCreateObjectURL });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, writable: true, value: originalRevokeObjectURL });
    vi.stubGlobal('ResizeObserver', originalResizeObserver);
    resizeObserverCallback = null;
  });

  it('scratches the Canvas cover without SVG paths or blob URLs during sustained scratching', () => {
    const { container } = render(createScratchHarness());
    const scratchHitArea = container.querySelector<HTMLElement>('[data-scratch-hit-area]');
    const scratchCanvas = container.querySelector<HTMLCanvasElement>('[data-scratch-canvas]');

    expect(scratchHitArea).toBeTruthy();
    expect(scratchCanvas).toBeTruthy();
    expect(container.querySelector('[data-scratch-mask-svg]')).toBeNull();

    fireEvent.pointerDown(scratchHitArea!, { isPrimary: true, clientX: 10, clientY: 10, pointerId: 1 });
    for (let index = 0; index < 200; index += 1) {
      fireEvent.pointerMove(scratchHitArea!, {
        clientX: 12 + index,
        clientY: 10 + (index % 20),
        pointerId: 1,
      });
    }
    fireEvent.pointerUp(scratchHitArea!, { clientX: 212, clientY: 25, pointerId: 1 });

    expect(imageDataReads).toBeGreaterThan(0);
    expect(createObjectURLSpy).not.toHaveBeenCalled();
    expect(revokeObjectURLSpy).not.toHaveBeenCalled();
  });

  it('fires scratch-complete exactly once when the threshold is crossed under heavy pointer traffic', () => {
    const triggerWidgetAction = vi.fn();
    const { container } = render(createScratchHarness({
      autoRevealThresholdPercent: 30,
      triggerWidgetAction,
    }));
    const scratchHitArea = container.querySelector<HTMLElement>('[data-scratch-hit-area]');

    expect(scratchHitArea).toBeTruthy();

    fireEvent.pointerDown(scratchHitArea!, { isPrimary: true, clientX: 16, clientY: 16, pointerId: 1 });
    for (let index = 0; index < 200; index += 1) {
      fireEvent.pointerMove(scratchHitArea!, {
        clientX: 16 + index,
        clientY: 16 + (index % 10),
        pointerId: 1,
      });
    }
    fireEvent.pointerUp(scratchHitArea!, { clientX: 220, clientY: 30, pointerId: 1 });

    const completionCalls = triggerWidgetAction.mock.calls.filter(([trigger]) => trigger === 'scratch-complete');
    expect(completionCalls).toHaveLength(1);
    expect(createObjectURLSpy).not.toHaveBeenCalled();
    expect(revokeObjectURLSpy).not.toHaveBeenCalled();
  });

  it('keeps the scratch completed after parent resizes or rerenders', () => {
    const triggerWidgetAction = vi.fn();
    const { container, rerender } = render(createScratchHarness({
      autoRevealThresholdPercent: 30,
      triggerWidgetAction,
      width: 320,
    }));
    const scratchHitArea = container.querySelector<HTMLElement>('[data-scratch-hit-area]');

    fireEvent.pointerDown(scratchHitArea!, { isPrimary: true, clientX: 16, clientY: 16, pointerId: 1 });
    for (let index = 0; index < 10; index += 1) {
      fireEvent.pointerMove(scratchHitArea!, {
        clientX: 18 + index,
        clientY: 18,
        pointerId: 1,
      });
    }

    const coverLayer = container.querySelector<HTMLElement>('[data-scratch-cover-layer]');
    const completedHitArea = container.querySelector<HTMLElement>('[data-scratch-hit-area]');
    expect(coverLayer?.style.opacity).toBe('0');
    expect(completedHitArea?.dataset.scratchCompleted).toBe('true');

    resizeObserverCallback?.([], {} as ResizeObserver);
    rerender(createScratchHarness({
      autoRevealThresholdPercent: 30,
      triggerWidgetAction,
      width: 420,
    }));

    const resizedCoverLayer = container.querySelector<HTMLElement>('[data-scratch-cover-layer]');
    const resizedHitArea = container.querySelector<HTMLElement>('[data-scratch-hit-area]');
    const completionCalls = triggerWidgetAction.mock.calls.filter(([trigger]) => trigger === 'scratch-complete');

    expect(resizedCoverLayer?.style.opacity).toBe('0');
    expect(resizedHitArea?.dataset.scratchCompleted).toBe('true');
    expect(completionCalls).toHaveLength(1);
  });
});
