import { act, create } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WidgetNode } from '../../../domain/document/types';

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
  StageWidget: ({ node }: { node: WidgetNode }) => <div data-widget-id={node.id} />,
}));

vi.mock('../../../canvas/stage/components/StageDropPreviewOverlay', () => ({
  StageDropPreviewOverlay: () => null,
}));

import { StageSurface, type StageSurfaceProps } from '../../../canvas/stage/components/StageSurface';

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
    isPlaying: false,
    editModeWireframe: false,
    zoom: 1,
    playheadMs: 100,
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
    isWidgetVisible: () => true,
    onStagePointerDown: vi.fn(),
    onStageDragOver: vi.fn(),
    onStageDragLeave: vi.fn(),
    onStageDrop: vi.fn(),
    onWidgetPointerDown: vi.fn(),
    onResizePointerDown: vi.fn(),
    onSetActiveWidget: vi.fn(),
    onSetHoveredWidget: vi.fn(),
    onExecuteAction: vi.fn(),
    ...overrides,
  };
}

describe('StageSurface motion behavior', () => {
  beforeEach(() => {
    engine.resetEventClocks.mockReset();
    engine.seekScene.mockReset();
    engine.emit.mockReset();
  });

  it('does not reset interaction clocks when scrubbing backwards in preview mode', () => {
    const root = create(<StageSurface {...buildProps()} />);

    act(() => {
      root.update(<StageSurface {...buildProps({ playheadMs: 40 })} />);
    });

    expect(engine.resetEventClocks).not.toHaveBeenCalled();
  });

  it('still resets interaction clocks when preview mode turns off', () => {
    const root = create(<StageSurface {...buildProps()} />);

    act(() => {
      root.update(<StageSurface {...buildProps({ previewMode: false })} />);
    });

    expect(engine.resetEventClocks).toHaveBeenCalledTimes(1);
  });
});
