import { describe, expect, it } from 'vitest';
import type { WidgetNode } from '../../../domain/document/types';
import { derivePlansForWidget } from '../../../motion/animation-engine/plan';

function createWidget(overrides: Partial<WidgetNode> & Pick<WidgetNode, 'id' | 'type'>): WidgetNode {
  return {
    id: overrides.id,
    type: overrides.type,
    name: overrides.name ?? overrides.id,
    sceneId: overrides.sceneId ?? 'scene_1',
    zIndex: overrides.zIndex ?? 1,
    frame: overrides.frame ?? { x: 0, y: 0, width: 120, height: 60, rotation: 0 },
    props: overrides.props ?? {},
    style: overrides.style ?? { opacity: 1 },
    timeline: overrides.timeline ?? { startMs: 0, endMs: 1500 },
    parentId: overrides.parentId,
    childIds: overrides.childIds,
    hidden: overrides.hidden,
    locked: overrides.locked,
    motion: overrides.motion,
    hoverMotion: overrides.hoverMotion,
    bindings: overrides.bindings,
    variants: overrides.variants,
    conditions: overrides.conditions,
    sharedLayerId: overrides.sharedLayerId,
  };
}

describe('animation engine plan derivation', () => {
  it('derives hover enter and hover exit plans from hoverMotion', () => {
    const widget = createWidget({
      id: 'cta_1',
      type: 'cta',
      hoverMotion: {
        templateId: 'lift',
        config: { durationMs: 260, distancePx: 16 },
      },
    });

    const plans = derivePlansForWidget(widget, { widgetsById: { [widget.id]: widget }, previewMode: true });

    expect(plans.filter((plan) => plan.phase === 'interaction').map((plan) => plan.trigger)).toEqual(['hover-enter', 'hover-exit']);
    expect(plans.find((plan) => plan.trigger === 'hover-enter')?.spec.to.transform).toContain('-16px');
  });

  it('offsets idle load plans until enter completes when both share the same trigger', () => {
    const widget = createWidget({
      id: 'image_1',
      type: 'image',
      motion: {
        enter: {
          templateId: 'fade-up',
          trigger: 'load',
          config: { durationMs: 400, delayMs: 50, distancePx: 24 },
        },
        idle: {
          templateId: 'float',
          trigger: 'load',
          config: { durationMs: 1200, delayMs: 25, distancePx: 8 },
        },
      },
    });

    const plans = derivePlansForWidget(widget, { widgetsById: { [widget.id]: widget }, previewMode: true });
    const enterPlan = plans.find((plan) => plan.phase === 'enter');
    const idlePlan = plans.find((plan) => plan.phase === 'idle');

    expect(enterPlan?.delayMs).toBe(50);
    expect(idlePlan?.delayMs).toBe(475);
  });

  it('inherits motion plans from pass-through ancestor groups when the child has no motion of its own', () => {
    const group = createWidget({
      id: 'group_1',
      type: 'group',
      childIds: ['image_1'],
      motion: {
        enter: {
          templateId: 'slide-in-left',
          trigger: 'scene-enter',
          config: { durationMs: 700, delayMs: 20, distancePx: 90 },
        },
      },
    });
    const child = createWidget({
      id: 'image_1',
      type: 'image',
      parentId: 'group_1',
    });

    const plans = derivePlansForWidget(child, {
      widgetsById: { [group.id]: group, [child.id]: child },
      previewMode: true,
    });

    expect(plans).toHaveLength(1);
    expect(plans[0]?.id).toContain(':inherit:image_1');
    expect(plans[0]?.trigger).toBe('scene-enter');
    expect(plans[0]?.widgetId).toBe('image_1');
    expect(plans[0]?.targetId).toBe('image_1');
  });
});
