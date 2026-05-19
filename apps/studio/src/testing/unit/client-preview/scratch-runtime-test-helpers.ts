// @vitest-environment jsdom

import { vi } from 'vitest';
import type { AnimationEngine } from '../../../motion/animation-engine/engine';
import type { ExportRuntimeModel, ExportRuntimeScene, ExportRuntimeWidget } from '../../../export/runtime-model';
import type { SceneManager } from '../../../export/runtime/scene-manager';

type FakeCanvasContext = {
  globalCompositeOperation: string;
  fillStyle: string;
  filter: string;
  lineCap: CanvasLineCap;
  lineJoin: CanvasLineJoin;
  lineWidth: number;
  clearRect: () => void;
  fillRect: () => void;
  drawImage: () => void;
  save: () => void;
  restore: () => void;
  beginPath: () => void;
  moveTo: () => void;
  lineTo: () => void;
  stroke: () => void;
  fill: () => void;
  ellipse: () => void;
  arc: () => void;
  getImageData: () => ImageData;
};

type ProgressCanvas = HTMLCanvasElement & { __scratchProgress?: number };

function incrementScratchProgress(canvas: ProgressCanvas): void {
  const next = Math.min(100, Number(canvas.__scratchProgress ?? 0) + 10);
  canvas.__scratchProgress = next;
}

export function installScratchCanvasMock(): () => void {
  const originalGetContext = HTMLCanvasElement.prototype.getContext;
  const originalToDataUrl = HTMLCanvasElement.prototype.toDataURL;
  const originalToBlob = HTMLCanvasElement.prototype.toBlob;
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;

  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    value: function getContext(this: ProgressCanvas, kind: string): FakeCanvasContext | null {
      if (kind !== '2d') return null;
      const canvas = this;
      return {
        globalCompositeOperation: 'source-over',
        fillStyle: '#000000',
        filter: 'none',
        lineCap: 'butt',
        lineJoin: 'miter',
        lineWidth: 1,
        clearRect: () => {},
        fillRect: () => {},
        drawImage: () => {},
        save: () => {},
        restore: () => {},
        beginPath: () => {},
        moveTo: () => {},
        lineTo: () => {},
        stroke: () => {
          incrementScratchProgress(canvas);
        },
        fill: () => {
          incrementScratchProgress(canvas);
        },
        ellipse: () => {},
        arc: () => {},
        getImageData: () => {
          const pixelCount = Math.max(1, canvas.width * canvas.height);
          const pixels = new Uint8ClampedArray(pixelCount * 4);
          const alpha = Math.round(255 * (1 - Number(canvas.__scratchProgress ?? 0) / 100));
          for (let index = 3; index < pixels.length; index += 4) {
            pixels[index] = alpha;
          }
          return { data: pixels } as ImageData;
        },
      };
    },
  });

  Object.defineProperty(HTMLCanvasElement.prototype, 'toDataURL', {
    configurable: true,
    value: () => 'data:image/png;base64,ZmFrZQ==',
  });

  Object.defineProperty(HTMLCanvasElement.prototype, 'toBlob', {
    configurable: true,
    value: function toBlob(
      this: HTMLCanvasElement,
      callback: BlobCallback,
      type?: string,
    ) {
      callback(new Blob(['fake'], { type: type ?? 'image/png' }));
    },
  });

  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: () => 'blob:mock-scratch-mask',
  });

  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    value: () => {},
  });

  return () => {
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      configurable: true,
      value: originalGetContext,
    });
    Object.defineProperty(HTMLCanvasElement.prototype, 'toDataURL', {
      configurable: true,
      value: originalToDataUrl,
    });
    Object.defineProperty(HTMLCanvasElement.prototype, 'toBlob', {
      configurable: true,
      value: originalToBlob,
    });
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: originalCreateObjectURL,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: originalRevokeObjectURL,
    });
  };
}

export function setScratchShellSize(shell: HTMLElement, width = 200, height = 100): void {
  Object.defineProperty(shell, 'clientWidth', { configurable: true, value: width });
  Object.defineProperty(shell, 'clientHeight', { configurable: true, value: height });
  Object.defineProperty(shell, 'offsetWidth', { configurable: true, value: width });
  Object.defineProperty(shell, 'offsetHeight', { configurable: true, value: height });
  shell.getBoundingClientRect = () => ({
    x: 0,
    y: 0,
    width,
    height,
    top: 0,
    left: 0,
    right: width,
    bottom: height,
    toJSON: () => ({}),
  } as DOMRect);
}

export function dispatchScratchPointerEvent(target: EventTarget, type: string, clientX: number, clientY: number): void {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperties(event, {
    clientX: { configurable: true, value: clientX },
    clientY: { configurable: true, value: clientY },
    pointerId: { configurable: true, value: 1 },
    pointerType: { configurable: true, value: 'mouse' },
  });
  if (target instanceof HTMLElement) {
    const hitArea = target.querySelector<HTMLElement>('[data-scratch-hit-area]');
    if (hitArea) {
      hitArea.dispatchEvent(event);
      return;
    }
  }
  target.dispatchEvent(event);
}

export function createRuntimeWidget(
  overrides: Partial<ExportRuntimeWidget> & Pick<ExportRuntimeWidget, 'id' | 'type' | 'sceneId'>,
): ExportRuntimeWidget {
  return {
    id: overrides.id,
    type: overrides.type,
    sceneId: overrides.sceneId,
    zIndex: overrides.zIndex ?? 1,
    parentId: overrides.parentId,
    childIds: overrides.childIds,
    frame: overrides.frame ?? { x: 0, y: 0, width: 100, height: 60, rotation: 0 },
    props: overrides.props ?? {},
    style: overrides.style ?? {},
    motion: overrides.motion,
    hoverMotion: overrides.hoverMotion,
    compositorMotion: overrides.compositorMotion,
    timeline: overrides.timeline ?? { startMs: 0, endMs: 1500, keyframes: [] },
    hidden: overrides.hidden ?? false,
    interactive: overrides.interactive ?? false,
    gestures: overrides.gestures ?? [],
    actionIds: overrides.actionIds ?? [],
  };
}

export function createRuntimeScene(
  overrides: Partial<ExportRuntimeScene> & Pick<ExportRuntimeScene, 'id' | 'name' | 'order' | 'durationMs' | 'widgets'>,
): ExportRuntimeScene {
  return {
    id: overrides.id,
    name: overrides.name,
    order: overrides.order,
    durationMs: overrides.durationMs,
    nextSceneId: overrides.nextSceneId,
    widgets: overrides.widgets,
  };
}

export function createRuntimeModel(scene: ExportRuntimeScene): ExportRuntimeModel {
  return {
    version: 1,
    targetChannel: 'generic-html5',
    canvas: { width: 300, height: 250, backgroundColor: '#000000' },
    interactions: [],
    fontFaces: [],
    scenes: [scene],
  };
}

export function createEngineStub(): AnimationEngine {
  return {
    buildPlansForWidget: () => [],
    play: () => {
      throw new Error('play() should not be called in scratch runtime tests');
    },
    cancel: () => {},
    cancelAllForWidget: () => {},
    emit: vi.fn(),
    subscribe: () => () => {},
    seekScene: () => {},
    pauseEventClocks: () => {},
    resumeEventClocks: () => {},
    resetEventClocks: () => {},
    getActivePlaybacks: () => [],
    hasFiredFor: () => false,
    dispose: () => {},
  };
}

export function createSceneManagerStub(overrides: Partial<SceneManager> = {}): SceneManager {
  return {
    showScene: vi.fn(),
    nextScene: vi.fn(),
    previousScene: vi.fn(),
    findSceneIndexById: vi.fn(() => -1),
    getActiveSceneIndex: vi.fn(() => 0),
    getActiveScene: vi.fn(() => null),
    getSceneElapsedMs: vi.fn(() => 0),
    dispose: vi.fn(),
    ...overrides,
  };
}

export function mountScratchDom(attributes: Record<string, string>): { root: HTMLElement; shell: HTMLElement; canvas: HTMLCanvasElement } {
  document.body.innerHTML = `
    <div data-widget-id="scratch_group">
      <div data-scratch>
        <div data-scratch-reveal></div>
        <div data-scratch-cover>
          <canvas data-scratch-canvas></canvas>
        </div>
        <div data-scratch-hit-area></div>
      </div>
    </div>
  `;
  const root = document.querySelector<HTMLElement>('[data-widget-id="scratch_group"]');
  const shell = document.querySelector<HTMLElement>('[data-scratch]');
  const canvas = document.querySelector<HTMLCanvasElement>('[data-scratch-canvas]');
  if (!root || !shell || !canvas) {
    throw new Error('scratch DOM did not mount');
  }
  Object.entries(attributes).forEach(([key, value]) => {
    shell.setAttribute(key, value);
  });
  root.setAttribute('data-scratch-widget-id', 'scratch_group');
  setScratchShellSize(shell);
  return { root, shell, canvas };
}
