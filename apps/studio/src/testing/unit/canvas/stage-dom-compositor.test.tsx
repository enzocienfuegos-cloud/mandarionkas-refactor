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
  syncScenePlayhead: vi.fn(),
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
  StageWidget: (props: { node: WidgetNode; widgetRef?: (node: HTMLDivElement | null) => void }) => {
    stageWidgetProps.push(props);
    return <div ref={props.widgetRef} data-stage-widget-id={props.node.id} />;
  },
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
    stageWidgetProps.length = 0;
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
    const querySelectorSpy = vi.spyOn(document, 'querySelector');
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
    expect(querySelectorSpy).not.toHaveBeenCalledWith('[data-stage-widget-id="widget_1"]');
  });

  it('keeps covered target widgets hidden until scratch completes, then hides the scratch subtree and reveals only the configured target subtree', () => {
    const scratchGroup = createWidget('scratch_group');
    scratchGroup.type = 'group';
    scratchGroup.zIndex = 5;
    scratchGroup.props = { scratchEnabled: true, revealTargetMode: 'widget', revealTargetId: 'target_group' };
    scratchGroup.childIds = ['cover_text'];
    scratchGroup.frame = { x: 0, y: 0, width: 220, height: 140, rotation: 0 };

    const coverText = createWidget('cover_text');
    coverText.parentId = 'scratch_group';
    coverText.zIndex = 6;
    coverText.frame = { x: 20, y: 20, width: 120, height: 40, rotation: 0 };

    const targetGroup = createWidget('target_group');
    targetGroup.type = 'group';
    targetGroup.childIds = ['target_card_1', 'target_card_2'];
    targetGroup.zIndex = 1;
    targetGroup.frame = { x: 0, y: 0, width: 220, height: 140, rotation: 0 };

    const targetCard1 = createWidget('target_card_1');
    targetCard1.parentId = 'target_group';
    targetCard1.zIndex = 2;
    targetCard1.frame = { x: 12, y: 18, width: 80, height: 60, rotation: 0 };

    const targetCard2 = createWidget('target_card_2');
    targetCard2.parentId = 'target_group';
    targetCard2.zIndex = 3;
    targetCard2.frame = { x: 112, y: 18, width: 80, height: 60, rotation: 0 };

    const bystander = createWidget('bystander');
    bystander.zIndex = 0;
    bystander.frame = { x: 8, y: 90, width: 100, height: 36, rotation: 0 };

    const { container } = render(
      <PlayheadRefProvider>
        <StageSurface
          {...buildProps({
            previewMode: true,
            isPlaying: false,
            widgets: [scratchGroup, targetGroup, bystander],
            widgetsById: {
              scratch_group: scratchGroup,
              cover_text: coverText,
              target_group: targetGroup,
              target_card_1: targetCard1,
              target_card_2: targetCard2,
              bystander,
            },
          })}
        />
      </PlayheadRefProvider>,
    );

    const scratchNode = container.querySelector<HTMLElement>('[data-stage-widget-id="scratch_group"]');
    const targetGroupNode = container.querySelector<HTMLElement>('[data-stage-widget-id="target_group"]');
    const bystanderNode = container.querySelector<HTMLElement>('[data-stage-widget-id="bystander"]');

    expect(scratchNode?.style.display).toBe('');
    expect(targetGroupNode?.style.display).toBe('none');
    expect(bystanderNode?.style.display).toBe('none');

    const scratchProps = stageWidgetProps.find((entry) => entry.node.id === 'scratch_group');
    expect(scratchProps).toBeTruthy();

    act(() => {
      scratchProps.onWidgetTrigger('scratch_group', 'scratch-complete', { completedAtMs: 320 });
    });

    expect(scratchNode?.style.display).toBe('none');
    expect(targetGroupNode?.style.display).toBe('');
    expect(bystanderNode?.style.display).toBe('none');
  });
});
