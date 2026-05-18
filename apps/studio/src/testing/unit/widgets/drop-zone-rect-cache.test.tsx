/** @vitest-environment jsdom */
import { act, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RenderContext } from '../../../canvas/stage/render-context';
import type { WidgetNode } from '../../../domain/document/types';
import { renderDropZoneStage } from '../../../widgets/modules/drop-zone.renderer';
import { emitTokenDrag } from '../../../widgets/modules/token-drag-runtime';

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

function createRect() {
  return {
    left: 0,
    top: 0,
    right: 160,
    bottom: 160,
    width: 160,
    height: 160,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  };
}

describe('drop zone rect cache', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('caches the drop-zone rect during move events and remeasures once at drag end', () => {
    const { container } = render(renderDropZoneStage(createDropZone(), createContext()));
    const shell = container.firstElementChild as HTMLDivElement | null;
    const zone = shell?.firstElementChild as HTMLDivElement | null;
    expect(zone).toBeTruthy();

    const getBoundingClientRect = vi.fn(() => createRect());
    Object.defineProperty(zone!, 'getBoundingClientRect', {
      configurable: true,
      value: getBoundingClientRect,
    });

    act(() => {
      emitTokenDrag({ phase: 'start', tokenId: 'tok_1', sourceWidgetId: 'pool_1', clientX: 10, clientY: 10 });
    });
    expect(getBoundingClientRect).toHaveBeenCalledTimes(1);

    for (let index = 0; index < 10; index += 1) {
      act(() => {
        emitTokenDrag({ phase: 'move', tokenId: 'tok_1', sourceWidgetId: 'pool_1', clientX: 20 + index, clientY: 20 + index });
      });
    }
    expect(getBoundingClientRect).toHaveBeenCalledTimes(1);

    act(() => {
      emitTokenDrag({ phase: 'end', tokenId: 'tok_1', sourceWidgetId: 'pool_1', clientX: 80, clientY: 80 });
    });
    expect(getBoundingClientRect).toHaveBeenCalledTimes(2);
  });

  it('invalidates the rect cache after resize and remeasures on the next move', () => {
    let scrollInvalidate: EventListener | null = null;
    const originalAddDocumentListener = document.addEventListener.bind(document);
    const addDocumentListenerSpy = vi.spyOn(document, 'addEventListener').mockImplementation(((type: string, listener: EventListenerOrEventListenerObject, options?: AddEventListenerOptions | boolean) => {
      if (type === 'scroll') {
        scrollInvalidate = typeof listener === 'function' ? listener : listener.handleEvent.bind(listener);
      }
      return originalAddDocumentListener(type, listener, options);
    }) as typeof document.addEventListener);

    const { container } = render(renderDropZoneStage(createDropZone(), createContext()));
    const shell = container.firstElementChild as HTMLDivElement | null;
    const zone = shell?.firstElementChild as HTMLDivElement | null;
    expect(zone).toBeTruthy();

    const getBoundingClientRect = vi.fn(() => createRect());
    Object.defineProperty(zone!, 'getBoundingClientRect', {
      configurable: true,
      value: getBoundingClientRect,
    });

    act(() => {
      emitTokenDrag({ phase: 'start', tokenId: 'tok_1', sourceWidgetId: 'pool_1', clientX: 10, clientY: 10 });
    });
    expect(getBoundingClientRect).toHaveBeenCalledTimes(1);
    expect(addDocumentListenerSpy).toHaveBeenCalled();
    expect(scrollInvalidate).toBeTypeOf('function');

    act(() => {
      scrollInvalidate?.(new Event('scroll'));
    });
    act(() => {
      emitTokenDrag({ phase: 'move', tokenId: 'tok_1', sourceWidgetId: 'pool_1', clientX: 22, clientY: 22 });
    });
    expect(getBoundingClientRect).toHaveBeenCalledTimes(2);
  });
});
