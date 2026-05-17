import { describe, expect, it } from 'vitest';
import type { WidgetNode } from '../../../domain/document/types';
import {
  buildRevealAnimationPlan,
  buildTimelineAnimationPlan,
  createRevealAnimationClock,
  resolveClockLocalMs,
  resolveTimelinePlayheadForClock,
  SCENE_ANIMATION_CLOCK,
} from '../../../motion/animation-clocks';

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
      templateId: 'slide-in-up',
      config: { durationMs: 700, delayMs: 0 },
    },
    ...overrides,
  };
}

describe('animation clocks', () => {
  it('keeps global timeline animations tied to absolute scene time', () => {
    const widget = createWidget();

    expect(resolveClockLocalMs(SCENE_ANIMATION_CLOCK, 2500, widget.timeline.startMs)).toBe(500);
    expect(resolveTimelinePlayheadForClock(widget, 2500, SCENE_ANIMATION_CLOCK)).toBe(2500);
  });

  it('starts reveal-triggered animations from event-local zero', () => {
    const widget = createWidget();
    const revealClock = createRevealAnimationClock(8000);

    expect(resolveClockLocalMs(revealClock, 8000, widget.timeline.startMs)).toBe(0);
    expect(resolveClockLocalMs(revealClock, 8350, widget.timeline.startMs)).toBe(350);
    expect(resolveTimelinePlayheadForClock(widget, 8350, revealClock)).toBe(2350);
  });

  it('classifies existing motion as timeline or reveal animation plans', () => {
    const widget = createWidget();

    expect(buildTimelineAnimationPlan(widget)).toMatchObject({
      widgetId: 'text_1',
      trigger: 'timeline',
      startMode: 'absolute-scene-time',
      phase: 'enter',
    });
    expect(buildRevealAnimationPlan(widget)).toMatchObject({
      widgetId: 'text_1',
      trigger: 'reveal',
      startMode: 'trigger-local-zero',
      phase: 'enter',
    });
  });
});
