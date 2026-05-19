/** @vitest-environment jsdom */
import { fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WidgetNode } from '../../../domain/document/types';
import type { RenderContext } from '../../../canvas/stage/render-context';
import { renderGroupWidget } from '../../../widgets/group/group.renderer';

function createScratchGroup(): WidgetNode {
  return {
    id: 'scratch_group',
    type: 'group',
    name: 'Scratch group',
    sceneId: 'scene_1',
    zIndex: 3,
    frame: { x: 0, y: 0, width: 320, height: 180, rotation: 0 },
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
      autoRevealThresholdPercent: 0,
    },
    timeline: { startMs: 0, endMs: 1000 },
    childIds: [],
  };
}

function createRenderContext(node: WidgetNode): RenderContext {
  return {
    sceneId: 'scene_1',
    widgetsById: { [node.id]: node },
    previewMode: true,
    isReproducing: false,
    playheadMs: 0,
    hovered: false,
    active: false,
    triggerWidgetAction: vi.fn(),
  } as unknown as RenderContext;
}

function ScratchHarness(): JSX.Element {
  const node = createScratchGroup();
  const ctx = createRenderContext(node);
  return renderGroupWidget(node, ctx);
}

describe('scratch flow does not use canvas.toDataURL', () => {
  let toDataURLSpy: ReturnType<typeof vi.spyOn>;
  let getContextSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
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
          getImageData: vi.fn(() => ({
            data: new Uint8ClampedArray(Math.max(4, this.width * this.height * 4)),
          })),
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
    toDataURLSpy = vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL');
  });

  afterEach(() => {
    toDataURLSpy.mockRestore();
    getContextSpy.mockRestore();
  });

  it('scratching does not invoke canvas.toDataURL', () => {
    const { container } = render(<ScratchHarness />);
    const scratchHitArea = container.querySelector<HTMLElement>('[data-scratch-hit-area]');

    expect(scratchHitArea).toBeTruthy();

    fireEvent.pointerDown(scratchHitArea!, { isPrimary: true, clientX: 10, clientY: 10, pointerId: 1 });
    for (let index = 0; index < 30; index += 1) {
      fireEvent.pointerMove(scratchHitArea!, {
        clientX: 10 + index * 4,
        clientY: 20 + (index % 4) * 3,
        pointerId: 1,
      });
    }
    fireEvent.pointerUp(scratchHitArea!, { clientX: 140, clientY: 42, pointerId: 1 });

    expect(toDataURLSpy).not.toHaveBeenCalled();
  });
});
