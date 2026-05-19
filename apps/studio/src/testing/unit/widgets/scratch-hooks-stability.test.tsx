/** @vitest-environment jsdom */
import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WidgetNode } from '../../../domain/document/types';
import type { RenderContext } from '../../../canvas/stage/render-context';
import { renderGroupWidget } from '../../../widgets/group/group.renderer';

function buildScratchGroup(scratchEnabled: boolean, previewMode: boolean): {
  node: WidgetNode;
  ctx: RenderContext;
} {
  const node: WidgetNode = {
    id: 'group_1',
    type: 'group',
    name: 'g',
    sceneId: 's1',
    zIndex: 5,
    frame: { x: 0, y: 0, width: 320, height: 180, rotation: 0 },
    style: { borderRadius: 18, opacity: 1 },
    props: { scratchEnabled, autoRevealThresholdPercent: 30, title: 'Scratch' },
    timeline: { startMs: 0, endMs: 2000 },
    childIds: [],
  } as WidgetNode;
  const ctx = {
    sceneId: 's1',
    widgetsById: { [node.id]: node },
    previewMode,
    isReproducing: false,
    playheadMs: 0,
    hovered: false,
    active: false,
    triggerWidgetAction: vi.fn(),
  } as unknown as RenderContext;
  return { node, ctx };
}

describe('scratch group hooks stability under toggles', () => {
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
  });

  afterEach(() => {
    getContextSpy.mockRestore();
  });

  it('does not throw when toggling scratchEnabled on and off repeatedly', () => {
    const { node, ctx } = buildScratchGroup(false, true);
    const { rerender } = render(renderGroupWidget(node, ctx));

    expect(() => {
      for (let index = 0; index < 5; index += 1) {
        node.props.scratchEnabled = index % 2 === 0;
        rerender(renderGroupWidget(node, ctx));
      }
    }).not.toThrow();
  });

  it('does not throw when toggling previewMode while scratchEnabled', () => {
    const { node, ctx } = buildScratchGroup(true, false);
    const { rerender } = render(renderGroupWidget(node, ctx));

    expect(() => {
      for (let index = 0; index < 5; index += 1) {
        (ctx as { previewMode: boolean }).previewMode = index % 2 === 0;
        rerender(renderGroupWidget(node, ctx));
      }
    }).not.toThrow();
  });

  it('renders the default group when scratchEnabled flips off mid-session', () => {
    const { node, ctx } = buildScratchGroup(true, true);
    const { container, rerender } = render(renderGroupWidget(node, ctx));

    expect(container.querySelector('[data-scratch]')).toBeTruthy();

    node.props.scratchEnabled = false;
    rerender(renderGroupWidget(node, ctx));

    expect(container.querySelector('[data-scratch]')).toBeNull();
  });

  it('renders the editor overlay instead of scratch shell outside preview mode', () => {
    const { node, ctx } = buildScratchGroup(true, false);
    const { container } = render(renderGroupWidget(node, ctx));

    expect(container.querySelector('[data-scratch]')).toBeNull();
  });
});
