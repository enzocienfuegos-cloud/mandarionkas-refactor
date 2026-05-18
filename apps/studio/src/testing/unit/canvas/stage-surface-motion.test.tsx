import { act, create } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WidgetNode } from '../../../domain/document/types';

const engine = {
  resetEventClocks: vi.fn(),
  seekScene: vi.fn(),
  emit: vi.fn(),
};

const stageWidgetProps: Array<any> = [];

vi.mock('../../../motion/animation-engine', async () => {
  const actual = await vi.importActual<typeof import('../../../motion/animation-engine')>('../../../motion/animation-engine');
  return {
    ...actual,
    createEventClock: actual.createEventClock,
    useAnimationEngine: () => engine,
  };
});

vi.mock('../../../canvas/stage/components/StageWidget', () => ({
  StageWidget: (props: { node: WidgetNode }) => {
    stageWidgetProps.push(props);
    return <div data-widget-id={props.node.id} />;
  },
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
    stageWidgetProps.length = 0;
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

  it('does not re-emit scene-enter when only the widgets array identity changes', () => {
    const widget = createWidget('widget_1');
    let root: ReturnType<typeof create>;

    act(() => {
      root = create(<StageSurface {...buildProps({ isPlaying: true, widgets: [widget], widgetsById: { [widget.id]: widget } })} />);
    });

    expect(engine.emit).toHaveBeenCalledTimes(1);

    act(() => {
      root!.update(
        <StageSurface
          {...buildProps({
            isPlaying: true,
            playheadMs: 180,
            widgets: [{ ...widget }],
            widgetsById: { [widget.id]: { ...widget } },
          })}
        />,
      );
    });

    expect(engine.emit).toHaveBeenCalledTimes(1);
  });

  it('emits reveal to the configured scratch target group and its descendants', () => {
    const scratchGroup = createWidget('scratch_group');
    scratchGroup.type = 'group';
    scratchGroup.props = { scratchEnabled: true, revealTargetMode: 'widget', revealTargetId: 'target_group' };
    scratchGroup.childIds = ['cover_text'];
    scratchGroup.zIndex = 5;

    const coverText = createWidget('cover_text');
    coverText.parentId = 'scratch_group';
    coverText.zIndex = 6;

    const targetGroup = createWidget('target_group');
    targetGroup.type = 'group';
    targetGroup.childIds = ['target_image'];
    targetGroup.zIndex = 1;

    const targetImage = createWidget('target_image');
    targetImage.parentId = 'target_group';
    targetImage.zIndex = 2;

    let scratchRoot: ReturnType<typeof create>;
    act(() => {
      scratchRoot = create(
        <StageSurface
          {...buildProps({
            widgets: [scratchGroup, targetGroup, targetImage],
            widgetsById: {
              scratch_group: scratchGroup,
              cover_text: coverText,
              target_group: targetGroup,
              target_image: targetImage,
            },
          })}
        />,
      );
    });

    const scratchWidgetProps = stageWidgetProps.find((entry) => entry.node.id === 'scratch_group');
    expect(scratchWidgetProps).toBeTruthy();

    act(() => {
      scratchWidgetProps.onWidgetTrigger('scratch_group', 'scratch-complete', { completedAtMs: 420 });
    });

    const revealCalls = engine.emit.mock.calls
      .map(([event]) => event)
      .filter((event) => event.trigger === 'reveal');

    expect(revealCalls).toHaveLength(2);
    expect(revealCalls.map((event) => event.targetId)).toEqual(['target_group', 'target_image']);
    expect(revealCalls.every((event) => event.sourceId === 'scratch_group')).toBe(true);

    act(() => {
      scratchRoot!.unmount();
    });
  });
});
