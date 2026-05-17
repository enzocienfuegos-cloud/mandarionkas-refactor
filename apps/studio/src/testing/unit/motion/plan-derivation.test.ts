import { describe, expect, it } from 'vitest';
import type { WidgetNode } from '../../../domain/document/types';
import { derivePlansForWidget } from '../../../motion/animation-engine/plan';

function createWidget(motion: WidgetNode['motion']): WidgetNode {
  return {
    id: 'widget_1',
    type: 'text',
    name: 'Widget',
    sceneId: 'scene_1',
    zIndex: 1,
    frame: { x: 0, y: 0, width: 160, height: 40, rotation: 0 },
    props: { text: 'Hola' },
    style: { opacity: 1 },
    motion,
    timeline: { startMs: 2000, endMs: 5000 },
  };
}

describe('plan derivation', () => {
  it('keeps load-triggered enter motion anchored to local zero', () => {
    const widget = createWidget({
      enter: {
        templateId: 'slide-in-left',
        trigger: 'load',
        config: { delayMs: 120, durationMs: 700, distancePx: 80 },
      },
    });

    const plan = derivePlansForWidget(widget, { widgetsById: { [widget.id]: widget }, previewMode: true })[0];

    expect(plan?.trigger).toBe('load');
    expect(plan?.delayMs).toBe(120);
    expect(plan?.startMode).toBe('trigger-local-zero');
  });

  it('adds scene timeline offset when the slot is timeline-triggered', () => {
    const widget = createWidget({
      enter: {
        templateId: 'slide-in-left',
        trigger: 'timeline',
        config: { delayMs: 120, durationMs: 700, distancePx: 80 },
      },
    });

    const plan = derivePlansForWidget(widget, { widgetsById: { [widget.id]: widget }, previewMode: true })[0];

    expect(plan?.trigger).toBe('timeline');
    expect(plan?.delayMs).toBe(2120);
    expect(plan?.startMode).toBe('absolute-scene-time');
  });

  it('chains idle plans after enter when both share the same trigger', () => {
    const widget = createWidget({
      enter: {
        templateId: 'fade-in',
        trigger: 'load',
        config: { delayMs: 80, durationMs: 200 },
      },
      idle: {
        templateId: 'float',
        trigger: 'load',
        config: { delayMs: 40, durationMs: 900, distancePx: 16 },
      },
    });

    const plans = derivePlansForWidget(widget, { widgetsById: { [widget.id]: widget }, previewMode: true });
    const idlePlan = plans.find((plan) => plan.phase === 'idle');

    expect(idlePlan?.delayMs).toBe(320);
  });
});
