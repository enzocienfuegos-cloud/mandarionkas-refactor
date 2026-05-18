import { describe, expect, it } from 'vitest';
import type { ExportRuntimeWidget } from '../../../export/runtime/runtime-model';
import { derivePlansForRuntimeWidget } from '../../../export/runtime/plan-runtime';

function createWidget(
  overrides: Partial<ExportRuntimeWidget> & Pick<ExportRuntimeWidget, 'id' | 'type' | 'sceneId'>,
): ExportRuntimeWidget {
  return {
    id: overrides.id,
    type: overrides.type,
    sceneId: overrides.sceneId,
    zIndex: overrides.zIndex ?? 1,
    parentId: overrides.parentId,
    childIds: overrides.childIds,
    frame: overrides.frame ?? { x: 0, y: 0, width: 120, height: 60, rotation: 0 },
    props: overrides.props ?? {},
    style: overrides.style ?? { opacity: 1 },
    motion: overrides.motion,
    hoverMotion: overrides.hoverMotion,
    compositorMotion: overrides.compositorMotion,
    timeline: overrides.timeline ?? { startMs: 0, endMs: 1500, keyframes: [] },
    hidden: overrides.hidden ?? false,
    interactive: overrides.interactive ?? false,
    gestures: overrides.gestures ?? [],
    actionIds: overrides.actionIds ?? [],
  };
}

describe('runtime plan derivation', () => {
  it('merges inherited parent triggers that do not collide with the child plans', () => {
    const group = createWidget({
      id: 'group_1',
      type: 'group',
      sceneId: 'scene_1',
      childIds: ['cta_1'],
      motion: {
        enter: {
          templateId: 'fade-up',
          trigger: 'reveal',
          config: { durationMs: 600, delayMs: 40, distancePx: 32 },
        },
      },
    });
    const child = createWidget({
      id: 'cta_1',
      type: 'cta',
      sceneId: 'scene_1',
      parentId: 'group_1',
      motion: {
        enter: {
          templateId: 'slide-in-right',
          trigger: 'load',
          config: { durationMs: 500, delayMs: 0, distancePx: 24 },
        },
      },
    });

    const plans = derivePlansForRuntimeWidget(child, {
      widgetsById: { [group.id]: group, [child.id]: child },
      previewMode: true,
    });

    expect(plans.map((plan) => `${plan.trigger}:${plan.id.includes(':inherit:') ? 'inherit' : 'own'}`)).toEqual([
      'load:own',
      'reveal:inherit',
    ]);
  });

  it('applies child cascade delay to inherited runtime plans based on child order', () => {
    const group = createWidget({
      id: 'group_1',
      type: 'group',
      sceneId: 'scene_1',
      childIds: ['text_1', 'cta_1', 'image_1'],
      props: { childCascadeDelayMs: 150 },
      motion: {
        enter: {
          templateId: 'fade-up',
          trigger: 'reveal',
          config: { durationMs: 600, delayMs: 25, distancePx: 32 },
        },
      },
    });
    const child = createWidget({
      id: 'image_1',
      type: 'image',
      sceneId: 'scene_1',
      parentId: 'group_1',
    });

    const plans = derivePlansForRuntimeWidget(child, {
      widgetsById: {
        [group.id]: group,
        text_1: createWidget({ id: 'text_1', type: 'text', sceneId: 'scene_1', parentId: 'group_1' }),
        cta_1: createWidget({ id: 'cta_1', type: 'cta', sceneId: 'scene_1', parentId: 'group_1' }),
        [child.id]: child,
      },
      previewMode: true,
    });

    expect(plans).toHaveLength(1);
    expect(plans[0]?.delayMs).toBe(325);
    expect(plans[0]?.trigger).toBe('reveal');
  });
});
