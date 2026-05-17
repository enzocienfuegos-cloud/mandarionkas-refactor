import { describe, expect, it } from 'vitest';
import type { WidgetNode } from '../../../domain/document/types';
import {
  clockLocalElapsedMs,
  createEventClock,
  SCENE_CLOCK,
  type AnimationClock,
} from '../../../motion/animation-engine/clock';
import { derivePlansForWidget } from '../../../motion/animation-engine/plan';

function resolveClockLocalMs(
  clock: AnimationClock | undefined,
  scenePlayheadMs: number,
  timelineStartMs = 0,
): number {
  const targetClock = clock ?? SCENE_CLOCK;
  if (targetClock.kind === 'scene' || targetClock.startMode !== 'trigger-local-zero') {
    return Math.max(0, scenePlayheadMs - timelineStartMs);
  }
  return clockLocalElapsedMs(targetClock, scenePlayheadMs);
}

function resolveTimelinePlayheadForClock(
  widget: Pick<WidgetNode, 'timeline'>,
  scenePlayheadMs: number,
  clock: AnimationClock | undefined,
): number {
  const targetClock = clock ?? SCENE_CLOCK;
  if (targetClock.kind === 'scene' || targetClock.startMode !== 'trigger-local-zero') return scenePlayheadMs;
  return widget.timeline.startMs + resolveClockLocalMs(targetClock, scenePlayheadMs, widget.timeline.startMs);
}

function buildAnimationPlan(widget: WidgetNode, trigger: 'timeline' | 'reveal') {
  return derivePlansForWidget(widget, { widgetsById: { [widget.id]: widget }, previewMode: true })
    .find((plan) => plan.trigger === trigger) ?? null;
}

function createWidget(overrides: Partial<WidgetNode> = {}): WidgetNode {
  return {
    id: 'text_1',
    type: 'text',
    name: 'Text',
    sceneId: 'scene_1',
    zIndex: 1,
    frame: { x: 0, y: 0, width: 120, height: 40, rotation: 0 },
    props: { text: 'Reveal me' },
    style: { opacity: 1 },
    timeline: { startMs: 2000, endMs: 5000 },
    motion: {
      enter: {
        templateId: 'slide-in-up',
        config: { durationMs: 700, delayMs: 0 },
        trigger: 'timeline',
      },
    },
    ...overrides,
  };
}

describe('animation clocks', () => {
  it('keeps global timeline animations tied to absolute scene time', () => {
    const widget = createWidget();

    expect(resolveClockLocalMs(SCENE_CLOCK, 2500, widget.timeline.startMs)).toBe(500);
    expect(resolveTimelinePlayheadForClock(widget, 2500, SCENE_CLOCK)).toBe(2500);
  });

  it('starts reveal-triggered animations from event-local zero', () => {
    const widget = createWidget();
    const revealClock = createEventClock('reveal', 8000);

    expect(resolveClockLocalMs(revealClock, 8000, widget.timeline.startMs)).toBe(0);
    expect(resolveClockLocalMs(revealClock, 8350, widget.timeline.startMs)).toBe(350);
    expect(resolveTimelinePlayheadForClock(widget, 8350, revealClock)).toBe(2350);
  });

  it('classifies existing motion as timeline or reveal animation plans', () => {
    const timelineWidget = createWidget();
    const revealWidget = createWidget({
      motion: {
        enter: {
          templateId: 'slide-in-up',
          config: { durationMs: 700, delayMs: 0 },
          trigger: 'reveal',
        },
      },
    });

    expect(buildAnimationPlan(timelineWidget, 'timeline')).toMatchObject({
      widgetId: 'text_1',
      trigger: 'timeline',
      startMode: 'absolute-scene-time',
      phase: 'enter',
    });
    expect(buildAnimationPlan(revealWidget, 'reveal')).toMatchObject({
      widgetId: 'text_1',
      trigger: 'reveal',
      startMode: 'trigger-local-zero',
      phase: 'enter',
    });
  });
});
