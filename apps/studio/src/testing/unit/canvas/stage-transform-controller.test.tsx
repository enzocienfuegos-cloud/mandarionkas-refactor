/** @vitest-environment jsdom */
import { Profiler, useRef } from 'react';
import { act, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createInitialState } from '../../../domain/document/factories';
import { useStageTransformController } from '../../../canvas/stage/controllers/use-stage-transform-controller';
import type { StudioState, WidgetNode } from '../../../domain/document/types';

function createWidget(): WidgetNode {
  return {
    id: 'widget_1',
    type: 'text',
    name: 'Widget 1',
    sceneId: 'scene_1',
    zIndex: 1,
    frame: { x: 24, y: 36, width: 180, height: 72, rotation: 0 },
    props: { text: 'Hello' },
    style: { opacity: 1 },
    timeline: { startMs: 0, endMs: 2000 },
  };
}

function buildState(): StudioState {
  const state = createInitialState();
  const scene = state.document.scenes[0];
  const widget = createWidget();
  return {
    ...state,
    document: {
      ...state.document,
      selection: {
        ...state.document.selection,
        activeSceneId: scene.id,
        widgetIds: [],
        primaryWidgetId: undefined,
      },
      widgets: {
        ...state.document.widgets,
        [widget.id]: widget,
      },
      scenes: [
        {
          ...scene,
          widgetIds: [widget.id],
        },
      ],
    },
  };
}

function Harness({
  state,
  onUpdateWidgetFrames,
}: {
  state: StudioState;
  onUpdateWidgetFrames: ReturnType<typeof vi.fn>;
}) {
  const workspaceRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const fullStateRef = useRef(state);
  const controller = useStageTransformController({
    workspaceRef,
    stageRef,
    zoom: 1,
    previewMode: false,
    canvas: state.document.canvas,
    playheadMs: 0,
    fullStateRef,
    widgetsById: state.document.widgets,
    selectWidget: vi.fn(),
    updateWidgetFrames: onUpdateWidgetFrames,
  });

  return (
    <div ref={workspaceRef}>
      <div
        ref={stageRef}
        data-testid="stage"
        style={{ position: 'relative', width: state.document.canvas.width, height: state.document.canvas.height }}
      >
        <div
          data-stage-widget-id="widget_1"
          data-testid="widget"
          onPointerDown={(event) => controller.beginWidgetDrag(event.nativeEvent, 'widget_1', false, false)}
        />
      </div>
    </div>
  );
}

describe('useStageTransformController', () => {
  let rafCallbacks: FrameRequestCallback[] = [];

  beforeEach(() => {
    rafCallbacks = [];
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

  it('moves dragged widgets through direct DOM mutations without rerendering on pointermove', () => {
    const updateWidgetFrames = vi.fn();
    const state = buildState();
    let commitCount = 0;

    const { getByTestId } = render(
      <Profiler id="stage-transform-controller" onRender={() => { commitCount += 1; }}>
        <Harness state={state} onUpdateWidgetFrames={updateWidgetFrames} />
      </Profiler>,
    );

    const stage = getByTestId('stage');
    const widget = getByTestId('widget');
    Object.defineProperty(stage, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ left: 0, top: 0, width: 970, height: 250, right: 970, bottom: 250 }),
    });

    act(() => {
      fireEvent.pointerDown(widget, { pointerId: 1, clientX: 24, clientY: 36 });
    });

    const commitsAfterPointerDown = commitCount;

    for (let index = 0; index < 8; index += 1) {
      act(() => {
        fireEvent.pointerMove(window, { pointerId: 1, clientX: 64 + index * 10, clientY: 86 + index * 10 });
      });
      const callback = rafCallbacks.shift();
      expect(callback).toBeTruthy();
      act(() => {
        callback?.(performance.now());
      });
    }

    expect(commitCount).toBe(commitsAfterPointerDown);
    expect((widget as HTMLDivElement).style.transform).toBe('translate3d(134px, 156px, 0) rotate(0deg)');
    expect((widget as HTMLDivElement).style.width).toBe('180px');
    expect((widget as HTMLDivElement).style.height).toBe('72px');

    act(() => {
      fireEvent.pointerUp(window, { pointerId: 1, clientX: 134, clientY: 156 });
    });

    expect(updateWidgetFrames).toHaveBeenCalledTimes(1);
    expect(updateWidgetFrames).toHaveBeenCalledWith([
      {
        widgetId: 'widget_1',
        patch: expect.objectContaining({ x: 134, y: 156, width: 180, height: 72, rotation: 0 }),
      },
    ]);
  });
});
