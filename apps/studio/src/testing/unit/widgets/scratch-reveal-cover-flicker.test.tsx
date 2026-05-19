/** @vitest-environment jsdom */
import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RenderContext } from '../../../canvas/stage/render-context';
import type { WidgetNode } from '../../../domain/document/types';
import { renderScratchRevealStage } from '../../../widgets/modules/scratch-reveal.renderer';

type MockImageInstance = {
  onload: null | (() => void);
  onerror: null | (() => void);
  crossOrigin?: string | null;
  src: string;
};

function createNode(beforeImage: string): WidgetNode {
  return {
    id: 'scratch_1',
    type: 'scratch-reveal',
    name: 'Scratch Reveal',
    sceneId: 'scene_1',
    zIndex: 1,
    frame: { x: 0, y: 0, width: 300, height: 180, rotation: 0 },
    props: {
      title: 'Scratch',
      coverLabel: 'Scratch to reveal',
      revealLabel: 'Reveal',
      beforeImage,
      afterImage: 'after.png',
      coverBlur: 0,
      scratchRadius: 24,
      autoRevealThresholdPercent: 20,
    },
    style: {},
    timeline: { startMs: 0, endMs: 2000 },
  };
}

function createContext(): RenderContext {
  return {
    previewMode: true,
    isReproducing: true,
    playheadMs: 0,
    sceneDurationMs: 2000,
    hovered: false,
    active: false,
    widgetsById: {},
    triggerWidgetAction: vi.fn(),
  };
}

describe('scratch reveal cover repaint', () => {
  const imageQueue: MockImageInstance[] = [];

  beforeEach(() => {
    imageQueue.length = 0;

    class MockImage {
      onload: null | (() => void) = null;
      onerror: null | (() => void) = null;
      crossOrigin: string | null = null;
      private _src = '';

      set src(value: string) {
        this._src = value;
        imageQueue.push(this as unknown as MockImageInstance);
      }

      get src() {
        return this._src;
      }
    }

    vi.stubGlobal('Image', MockImage as unknown as typeof Image);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => ({
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      drawImage: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      ellipse: vi.fn(),
      getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4) })),
      set fillStyle(_value: string) {},
      set filter(_value: string) {},
      set globalCompositeOperation(_value: string) {},
      set lineCap(_value: CanvasLineCap) {},
      set lineJoin(_value: CanvasLineJoin) {},
      set lineWidth(_value: number) {},
    }) as unknown as CanvasRenderingContext2D);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('keeps the existing cover visible while a replacement image repaints asynchronously', () => {
    const ctx = createContext();
    const { container, rerender } = render(renderScratchRevealStage(createNode('before-a.png'), ctx));

    const canvas = container.querySelector('canvas') as HTMLCanvasElement | null;
    expect(canvas).toBeTruthy();
    Object.defineProperty(canvas!, 'clientWidth', { configurable: true, value: 300 });
    Object.defineProperty(canvas!, 'clientHeight', { configurable: true, value: 180 });

    expect(canvas?.style.opacity).toBe('0');
    act(() => {
      imageQueue.shift()?.onload?.();
    });
    expect(canvas?.style.opacity).toBe('1');

    rerender(renderScratchRevealStage(createNode('before-b.png'), ctx));
    expect(imageQueue).toHaveLength(1);
    expect(canvas?.style.opacity).toBe('1');

    act(() => {
      imageQueue.shift()?.onload?.();
    });
    expect(canvas?.style.opacity).toBe('1');
  });
});
