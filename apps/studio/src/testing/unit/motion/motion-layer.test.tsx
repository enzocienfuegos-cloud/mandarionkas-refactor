// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WidgetNode } from '../../../domain/document/types';
import type { AnimationPlan } from '../../../motion/animation-engine/plan';

const { engine } = vi.hoisted(() => ({
  engine: {
    buildPlansForWidget: vi.fn(),
    play: vi.fn(),
    subscribe: vi.fn(),
    cancelAllForWidget: vi.fn(),
    seekScene: vi.fn(),
  },
}));

const plan: AnimationPlan = {
  id: 'widget_1:enter:fade-in',
  widgetId: 'widget_1',
  targetId: 'widget_1',
  templateId: 'fade-in',
  trigger: 'timeline',
  phase: 'enter',
  startMode: 'absolute-scene-time',
  delayMs: 0,
  durationMs: 400,
  iterations: 1,
  fill: 'both',
  replayPolicy: 'restart',
  spec: {
    from: { opacity: 0 },
    to: { opacity: 1 },
    ease: 'expo.out',
    willChange: 'opacity',
  },
};

function createWidget(overrides: Partial<WidgetNode> = {}): WidgetNode {
  return {
    id: 'widget_1',
    type: 'text',
    name: 'Widget',
    sceneId: 'scene_1',
    zIndex: 1,
    frame: { x: 0, y: 0, width: 120, height: 40, rotation: 0 },
    props: { text: 'Hello' },
    style: { opacity: 1 },
    timeline: { startMs: 0, endMs: 1500 },
    motion: {
      enter: {
        templateId: 'fade-in',
        trigger: 'timeline',
        config: { durationMs: 400, delayMs: 0 },
      },
    },
    ...overrides,
  };
}

describe('MotionLayer', () => {
  let MotionLayer: typeof import('../../../motion/react/MotionLayer').MotionLayer;
  let container: HTMLDivElement;
  let root: Root;

  beforeAll(async () => {
    const animationEngineModule = await import('../../../motion/animation-engine');
    engine.buildPlansForWidget.mockImplementation(() => [plan]);
    engine.subscribe.mockImplementation(() => () => {});
    vi.spyOn(animationEngineModule, 'useAnimationEngine').mockImplementation(() => engine as never);
    ({ MotionLayer } = await import('../../../motion/react/MotionLayer'));
  });

  beforeEach(() => {
    // React 18 expects this flag for deterministic act() flushing in jsdom.
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    engine.buildPlansForWidget.mockClear();
    engine.play.mockClear();
    engine.subscribe.mockClear();
    engine.cancelAllForWidget.mockClear();
    engine.seekScene.mockClear();
    engine.subscribe.mockImplementation(() => () => {});
  });

  afterEach(() => {
    void act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('does not restart timeline plays when the widget object identity changes but the motion plan does not', async () => {
    const widget = createWidget();

    await act(async () => {
      root.render(
        <MotionLayer widget={widget} playheadMs={120} isReproducing previewMode>
          <div>Child</div>
        </MotionLayer>,
      );
    });

    expect(engine.play).toHaveBeenCalledTimes(1);

    await act(async () => {
      root.render(
        <MotionLayer
          widget={{ ...widget, props: { ...widget.props, text: 'Hello again' } }}
          playheadMs={240}
          isReproducing
          previewMode
        >
          <div>Child</div>
        </MotionLayer>,
      );
    });

    expect(engine.play).toHaveBeenCalledTimes(1);
    expect(engine.subscribe).toHaveBeenCalledTimes(9);
  });

  it('ignores reveal events where the widget is only the source and not the target', async () => {
    const subscriptions = new Map<string, (event: { trigger: string; sourceId: string; targetId: string; clock: object }) => void>();
    engine.subscribe.mockImplementation((trigger: string, handler: (event: any) => void) => {
      subscriptions.set(trigger, handler);
      return () => subscriptions.delete(trigger);
    });

    const revealPlan: AnimationPlan = {
      ...plan,
      id: 'widget_1:enter:fade-in:reveal',
      trigger: 'reveal',
      startMode: 'trigger-local-zero',
    };
    engine.buildPlansForWidget.mockImplementation(() => [revealPlan]);

    await act(async () => {
      root.render(
        <MotionLayer widget={createWidget()} playheadMs={120} isReproducing previewMode>
          <div>Child</div>
        </MotionLayer>,
      );
    });

    engine.play.mockClear();
    const handler = subscriptions.get('reveal');
    expect(handler).toBeTruthy();

    await act(async () => {
      handler?.({
        trigger: 'reveal',
        sourceId: 'widget_1',
        targetId: 'other_widget',
        clock: {},
      });
    });

    expect(engine.play).not.toHaveBeenCalled();
  });
});
