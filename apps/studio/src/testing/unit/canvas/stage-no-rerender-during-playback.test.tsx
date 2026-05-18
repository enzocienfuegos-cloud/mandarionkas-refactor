/** @vitest-environment jsdom */
import { Profiler, type ProfilerOnRenderCallback } from 'react';
import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WidgetNode } from '../../../domain/document/types';
import { StageSurface, type StageSurfaceProps } from '../../../canvas/stage/components/StageSurface';
import { PlayheadRefProvider } from '../../../canvas/stage/playhead-ref-context';
import { playbackEngine } from '../../../hooks/use-playback-engine';

const engine = {
  resetEventClocks: vi.fn(),
  seekScene: vi.fn(),
  emit: vi.fn(),
};

vi.mock('../../../motion/animation-engine', async () => {
  const actual = await vi.importActual<typeof import('../../../motion/animation-engine')>('../../../motion/animation-engine');
  return {
    ...actual,
    createEventClock: actual.createEventClock,
    useAnimationEngine: () => engine,
  };
});

vi.mock('../../../canvas/stage/components/StageWidget', () => ({
  StageWidget: ({ node }: { node: WidgetNode }) => <div data-stage-widget-id={node.id} />,
}));

vi.mock('../../../canvas/stage/components/StageDropPreviewOverlay', () => ({
  StageDropPreviewOverlay: () => null,
}));

function createWidget(id: string): WidgetNode {
  return {
    id,
    type: 'text',
    name: id,
    sceneId: 'scene_1',
    zIndex: 1,
    frame: { x: 0, y: 0, width: 120, height: 60, rotation: 0 },
    props: { text: id },
    style: { opacity: 1 },
    timeline: { startMs: 0, endMs: 1500 },
  };
}

function buildProps(overrides: Partial<StageSurfaceProps> = {}): StageSurfaceProps {
  const widget = createWidget('widget_1');
  return {
    stageRef: { current: null },
    sceneId: 'scene_1',
    canvas: { width: 320, height: 480, backgroundColor: '#000000' },
    widgets: [widget],
    widgetsById: { [widget.id]: widget },
    selectedIds: [],
    previewMode: true,
    isPlaying: true,
    editModeWireframe: false,
    zoom: 1,
    sceneDurationMs: 2000,
    sceneTransitionType: 'cut',
    sceneTransitionDurationMs: 450,
    sceneTransitionActive: false,
    marquee: null,
    dropPreview: null,
    liveFrameById: {},
    hoveredWidgetId: undefined,
    activeWidgetId: undefined,
    showStageRulers: false,
    showWidgetBadges: false,
    stateRef: { current: {} as never },
    onStagePointerDown: vi.fn(),
    onStageDragOver: vi.fn(),
    onStageDragLeave: vi.fn(),
    onStageDrop: vi.fn(),
    onWidgetPointerDown: vi.fn(),
    onResizePointerDown: vi.fn(),
    onSetActiveWidget: vi.fn(),
    onSetHoveredWidget: vi.fn(),
    onExecuteAction: vi.fn(),
    onGoToScene: vi.fn(),
    ...overrides,
  };
}

describe('stage no-rerender during playback', () => {
  let rafCallbacks: FrameRequestCallback[] = [];

  beforeEach(() => {
    rafCallbacks = [];
    vi.stubGlobal('requestAnimationFrame', vi.fn((cb: FrameRequestCallback) => {
      rafCallbacks.push(cb);
      return rafCallbacks.length;
    }));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    playbackEngine.setCurrentMs(0);
    playbackEngine.flushReact();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('does not re-render StageSurface when playhead advances during playback', () => {
    let commitCount = 0;
    const onRender: ProfilerOnRenderCallback = () => {
      commitCount += 1;
    };

    render(
      <PlayheadRefProvider>
        <Profiler id="stage-surface" onRender={onRender}>
          <StageSurface {...buildProps()} />
        </Profiler>
      </PlayheadRefProvider>,
    );

    const initialCommits = commitCount;

    for (let frame = 0; frame < 30; frame += 1) {
      act(() => {
        playbackEngine.setCurrentMs((frame + 1) * 16);
        const callback = rafCallbacks.shift();
        callback?.(performance.now());
      });
    }

    expect(commitCount - initialCommits).toBeLessThanOrEqual(1);
  });
});
