// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { WidgetNode } from '../../../domain/document/types';
import { SCENE_CLOCK, createEventClock } from '../../../motion/animation-engine/clock';
import { GsapAnimationEngine } from '../../../motion/animation-engine/gsap-engine';
import type { AnimationPlan } from '../../../motion/animation-engine/plan';

function createWidget(id = 'widget_1'): WidgetNode {
  return {
    id,
    type: 'text',
    name: id,
    sceneId: 'scene_1',
    zIndex: 1,
    frame: { x: 0, y: 0, width: 120, height: 40, rotation: 0 },
    props: { text: id },
    style: { opacity: 1 },
    timeline: { startMs: 0, endMs: 1500 },
  };
}

function createPlan(overrides: Partial<AnimationPlan> = {}): AnimationPlan {
  return {
    id: 'widget_1:enter:fade-in',
    widgetId: 'widget_1',
    targetId: 'widget_1',
    templateId: 'fade-in',
    trigger: 'click',
    phase: 'interaction',
    startMode: 'trigger-local-zero',
    delayMs: 0,
    durationMs: 120,
    iterations: 1,
    fill: 'both',
    replayPolicy: 'restart',
    spec: {
      from: { opacity: 0 },
      to: { opacity: 1 },
      ease: 'none',
      willChange: 'opacity',
    },
    ...overrides,
  };
}

function createTarget(widget = createWidget()) {
  const node = document.createElement('div');
  node.setAttribute('data-widget-id', widget.id);
  document.body.appendChild(node);
  return { node, widget };
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('GsapAnimationEngine', () => {
  it('publishes events to subscribers and tracks fired sources', () => {
    const engine = new GsapAnimationEngine();
    const handler = vi.fn();
    const unsubscribe = engine.subscribe('click', handler);
    const event = {
      trigger: 'click' as const,
      sourceId: 'widget_1',
      targetId: 'widget_1',
      sceneTimeMs: 240,
      realTimeMs: 240,
      clock: createEventClock('click', 240),
    };

    engine.emit(event);

    expect(handler).toHaveBeenCalledWith(event);
    expect(engine.hasFiredFor('click', 'widget_1')).toBe(true);

    unsubscribe();
    engine.dispose();
  });

  it('restarts an in-flight playback when replayPolicy is restart', () => {
    const engine = new GsapAnimationEngine();
    const widget = createWidget();
    const target = createTarget(widget);
    const firstPlayback = engine.play(target, createPlan(), createEventClock('click', 100));
    const killSpy = vi.spyOn(firstPlayback.tl, 'kill');

    const secondPlayback = engine.play(target, createPlan(), createEventClock('click', 200));

    expect(secondPlayback.id).not.toBe(firstPlayback.id);
    expect(killSpy).toHaveBeenCalledTimes(1);
    expect(engine.getActivePlaybacks()).toHaveLength(1);

    engine.dispose();
  });

  it('ignores duplicate triggers while replayPolicy is ignore', () => {
    const engine = new GsapAnimationEngine();
    const widget = createWidget();
    const target = createTarget(widget);
    const plan = createPlan({ replayPolicy: 'ignore' });

    const firstPlayback = engine.play(target, plan, createEventClock('click', 100));
    const secondPlayback = engine.play(target, plan, createEventClock('click', 200));

    expect(secondPlayback).toBe(firstPlayback);
    expect(engine.getActivePlaybacks()).toHaveLength(1);

    engine.dispose();
  });

  it('queues the next playback until the current one completes when replayPolicy is queue', () => {
    const engine = new GsapAnimationEngine();
    const widget = createWidget();
    const target = createTarget(widget);
    const plan = createPlan({ replayPolicy: 'queue', durationMs: 10 });

    const firstPlayback = engine.play(target, plan, createEventClock('click', 100));
    const secondPlayback = engine.play(target, plan, createEventClock('click', 200));

    expect(secondPlayback).toBe(firstPlayback);
    expect(engine.getActivePlaybacks()).toHaveLength(1);

    firstPlayback.tl.progress(1);

    const activePlayback = engine.getActivePlaybacks()[0];
    expect(activePlayback).toBeDefined();
    expect(activePlayback?.clock.startedAtMs).toBe(200);

    engine.dispose();
  });

  it('resets event clocks without canceling scene-timeline playbacks', () => {
    const engine = new GsapAnimationEngine();
    const sceneTarget = createTarget(createWidget('scene_widget'));
    const eventTarget = createTarget(createWidget('event_widget'));
    const scenePlan = createPlan({ id: 'scene_widget:enter:fade-in', widgetId: 'scene_widget', targetId: 'scene_widget', trigger: 'timeline', phase: 'enter', startMode: 'absolute-scene-time' });
    const eventPlan = createPlan({ id: 'event_widget:click:fade-in', widgetId: 'event_widget', targetId: 'event_widget' });

    engine.play(sceneTarget, scenePlan, SCENE_CLOCK);
    engine.play(eventTarget, eventPlan, createEventClock('click', 120));
    engine.emit({
      trigger: 'click',
      sourceId: 'event_widget',
      targetId: 'event_widget',
      sceneTimeMs: 120,
      realTimeMs: 120,
      clock: createEventClock('click', 120),
    });

    engine.resetEventClocks();

    expect(engine.hasFiredFor('click', 'event_widget')).toBe(false);
    expect(engine.getActivePlaybacks()).toHaveLength(1);
    expect(engine.getActivePlaybacks()[0]?.clock.kind).toBe('scene');

    engine.dispose();
  });
});
