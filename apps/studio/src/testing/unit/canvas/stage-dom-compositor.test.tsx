/** @vitest-environment jsdom */
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
    frame: { x: 24, y: 36, width: 180, height: 72, rotation: 15 },
    props: { text: id },
    style: { opacity: 0.75 },
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

describe('StageSurface DOM compositor path', () => {
  let rafCallbacks: FrameRequestCallback[] = [];

  beforeEach(() => {
    rafCallbacks = [];
    vi.stubGlobal('requestAnimationFrame', vi.fn((cb: FrameRequestCallback) => {
      rafCallbacks.push(cb);
      return rafCallbacks.length;
    }));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    playbackEngine.setCurrentMs(250);
    playbackEngine.flushReact();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('positions widgets and playhead overlay with transform instead of left/top mutations', () => {
    const { container } = render(
      <PlayheadRefProvider>
        <StageSurface {...buildProps()} />
      </PlayheadRefProvider>,
    );

    const widget = container.querySelector<HTMLElement>('[data-stage-widget-id="widget_1"]');
    const playhead = container.querySelector<HTMLElement>('.playhead-overlay');

    expect(widget).toBeTruthy();
    expect(playhead).toBeTruthy();

    expect(widget?.style.transform).toBe('translate3d(24px, 36px, 0) rotate(15deg)');
    expect(widget?.style.left).toBe('');
    expect(widget?.style.top).toBe('');
    expect(widget?.style.width).toBe('180px');
    expect(widget?.style.height).toBe('72px');
    expect(widget?.dataset.frameWidth).toBe('180');
    expect(widget?.dataset.frameHeight).toBe('72');

    expect(playhead?.style.left).toBe('');
    expect(playhead?.style.transform).toBe('translate3d(40px, 0, 0)');

    act(() => {
      playbackEngine.setCurrentMs(500);
      const callback = rafCallbacks.shift();
      callback?.(performance.now());
    });

    expect(playhead?.style.transform).toBe('translate3d(80px, 0, 0)');
  });
});
