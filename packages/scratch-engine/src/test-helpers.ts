import { vi } from 'vitest';

type ProgressCanvas = HTMLCanvasElement & { __scratchProgress?: number };

function incrementScratchProgress(canvas: ProgressCanvas, amount = 30): void {
  canvas.__scratchProgress = Math.min(100, Number(canvas.__scratchProgress ?? 0) + amount);
}

export function installScratchCanvasMock(): () => void {
  const originalGetContext = HTMLCanvasElement.prototype.getContext;

  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    value: function getContext(this: ProgressCanvas, kind: string) {
      if (kind !== '2d') return null;
      return {
        canvas: this,
        globalCompositeOperation: 'source-over',
        fillStyle: '#000000',
        filter: 'none',
        lineCap: 'butt',
        lineJoin: 'miter',
        lineWidth: 1,
        clearRect: vi.fn(),
        fillRect: vi.fn(),
        drawImage: vi.fn(),
        save: vi.fn(),
        restore: vi.fn(),
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        stroke: vi.fn(() => incrementScratchProgress(this)),
        fill: vi.fn(() => incrementScratchProgress(this)),
        translate: vi.fn(),
        rotate: vi.fn(),
        arc: vi.fn(),
        roundRect: vi.fn(),
        closePath: vi.fn(),
        setTransform: vi.fn(),
        getTransform: vi.fn(() => null),
        measureText: vi.fn((value: string) => ({ width: value.length * 8 })),
        fillText: vi.fn(),
        getImageData: vi.fn(() => {
          const total = Math.max(4, this.width * this.height * 4);
          const data = new Uint8ClampedArray(total);
          const alpha = Math.round(255 * (1 - Number(this.__scratchProgress ?? 0) / 100));
          for (let index = 3; index < total; index += 4) data[index] = alpha;
          return { data } as ImageData;
        }),
      } as unknown as CanvasRenderingContext2D;
    },
  });

  return () => {
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      configurable: true,
      value: originalGetContext,
    });
  };
}

export function installResizeObserverMock(): () => void {
  const originalResizeObserver = globalThis.ResizeObserver;
  class MockResizeObserver {
    observe = vi.fn();
    disconnect = vi.fn();
    unobserve = vi.fn();
  }
  vi.stubGlobal('ResizeObserver', MockResizeObserver);
  return () => {
    vi.stubGlobal('ResizeObserver', originalResizeObserver);
  };
}

export function mountScratchRoot(attributes: Record<string, string> = {}): {
  root: HTMLElement;
  cover: HTMLElement;
  reveal: HTMLElement;
} {
  document.body.innerHTML = `
    <div data-scratch style="position:relative;width:200px;height:100px;">
      <div data-scratch-reveal></div>
      <div data-scratch-cover></div>
    </div>
  `;
  const root = document.querySelector<HTMLElement>('[data-scratch]');
  const cover = document.querySelector<HTMLElement>('[data-scratch-cover]');
  const reveal = document.querySelector<HTMLElement>('[data-scratch-reveal]');
  if (!root || !cover || !reveal) throw new Error('scratch DOM did not mount');
  Object.entries(attributes).forEach(([key, value]) => root.setAttribute(key, value));
  Object.defineProperty(root, 'clientWidth', { configurable: true, value: 200 });
  Object.defineProperty(root, 'clientHeight', { configurable: true, value: 100 });
  root.getBoundingClientRect = () => ({
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
  return { root, cover, reveal };
}

export function dispatchPointer(target: EventTarget, type: string, clientX: number, clientY: number): void {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperties(event, {
    clientX: { configurable: true, value: clientX },
    clientY: { configurable: true, value: clientY },
    pointerId: { configurable: true, value: 1 },
    pointerType: { configurable: true, value: 'mouse' },
    isPrimary: { configurable: true, value: true },
  });
  target.dispatchEvent(event);
}
