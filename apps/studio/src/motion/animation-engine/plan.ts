import type { WidgetNode } from '../../domain/document/types';
import { resolveWidgetHoverMotion } from '../motion-model';
import { resolveMotionIterations } from '../motion-iterations';
import { getMotionTemplate } from '../motion-registry';
import { readConfigNumber } from '../motion-engine';
import type { MotionConfig } from '../motion-template-contract';
import { DEFAULT_MOTION_DELAY_MS, DEFAULT_MOTION_DURATION_MS } from './constants';
import type { AnimationStartMode } from './clock';
import type { AnimationPhase, AnimationTrigger } from './events';
import { DEFAULT_REPLAY_POLICY, type ReplayPolicy } from './replay-policy';

export type AnimationSpec = {
  readonly from: Readonly<Record<string, string | number>>;
  readonly to: Readonly<Record<string, string | number>>;
  readonly ease: string;
  readonly transformOrigin?: string;
  readonly willChange?: string;
};

export type AnimationPlan = {
  readonly id: string;
  readonly widgetId: string;
  readonly targetId: string;
  readonly templateId: string;
  readonly trigger: AnimationTrigger;
  readonly phase: AnimationPhase;
  readonly startMode: AnimationStartMode;
  readonly delayMs: number;
  readonly durationMs: number;
  readonly iterations: number | 'infinite';
  readonly fill: 'none' | 'forwards' | 'backwards' | 'both';
  readonly replayPolicy: ReplayPolicy;
  readonly spec: AnimationSpec;
  readonly inheritsTo?: readonly string[];
};

export type PlanContext = {
  readonly widgetsById: Readonly<Record<string, WidgetNode>>;
  readonly previewMode: boolean;
};

function toAnimationSpecFrame(frame: { transform?: string; opacity?: number }): Record<string, string | number> {
  const spec: Record<string, string | number> = {};
  if (typeof frame.transform === 'string' && frame.transform.length) spec.transform = frame.transform;
  if (typeof frame.opacity === 'number') spec.opacity = frame.opacity;
  return spec;
}

function buildPlanFromSlot(
  widget: WidgetNode,
  slot: NonNullable<WidgetNode['motion']>[keyof NonNullable<WidgetNode['motion']>],
  phase: Exclude<AnimationPhase, 'interaction'>,
): AnimationPlan | null {
  if (!slot) return null;
  const template = getMotionTemplate(slot.templateId);
  if (!template?.buildSpec) return null;

  const durationMs = Math.max(1, readConfigNumber(slot.config as MotionConfig, 'durationMs', DEFAULT_MOTION_DURATION_MS));
  const rawDelayMs = Math.max(0, readConfigNumber(slot.config as MotionConfig, 'delayMs', DEFAULT_MOTION_DELAY_MS));
  const delayMs = slot.trigger === 'timeline' ? widget.timeline.startMs + rawDelayMs : rawDelayMs;
  const startMode: AnimationStartMode = slot.trigger === 'timeline' ? 'absolute-scene-time' : 'trigger-local-zero';

  return Object.freeze({
    id: `${widget.id}:${phase}:${slot.templateId}`,
    widgetId: widget.id,
    targetId: widget.id,
    templateId: slot.templateId,
    trigger: slot.trigger,
    phase,
    startMode,
    delayMs,
    durationMs,
    iterations: resolveMotionIterations(slot.config as MotionConfig, template.isLoop ? 'infinite' : 1),
    fill: 'both',
    replayPolicy: slot.replayPolicy ?? DEFAULT_REPLAY_POLICY,
    spec: template.buildSpec(slot.config as MotionConfig, widget),
  });
}

function isPassThroughMotionGroup(widget: WidgetNode): boolean {
  return widget.type === 'group'
    && Boolean(widget.childIds?.length)
    && !Boolean(widget.props.scratchEnabled);
}

function readChildCascadeDelayMs(widget: WidgetNode): number {
  const raw = Number(widget.props.childCascadeDelayMs ?? 0);
  return Number.isFinite(raw) ? Math.max(0, raw) : 0;
}

function cloneInheritedPlan(plan: AnimationPlan, widgetId: string, delayOffsetMs = 0): AnimationPlan {
  return Object.freeze({
    ...plan,
    id: `${plan.id}:inherit:${widgetId}`,
    widgetId,
    targetId: widgetId,
    delayMs: plan.delayMs + delayOffsetMs,
  });
}

function buildMotionPlans(widget: WidgetNode): AnimationPlan[] {
  const motion = widget.motion;
  if (!motion) return [];
  const enterPlan = motion.enter ? buildPlanFromSlot(widget, motion.enter, 'enter') : null;
  const rawIdlePlan = motion.idle ? buildPlanFromSlot(widget, motion.idle, 'idle') : null;
  const exitPlan = motion.exit ? buildPlanFromSlot(widget, motion.exit, 'exit') : null;
  const idlePlan = rawIdlePlan && enterPlan && enterPlan.trigger === rawIdlePlan.trigger
    ? Object.freeze({
        ...rawIdlePlan,
        delayMs: rawIdlePlan.delayMs + enterPlan.delayMs + enterPlan.durationMs,
      })
    : rawIdlePlan;

  const plans: AnimationPlan[] = [];
  if (enterPlan) plans.push(enterPlan);
  if (idlePlan) plans.push(idlePlan);
  if (exitPlan) plans.push(exitPlan);
  return plans;
}

function buildInheritedMotionPlans(widget: WidgetNode, context: PlanContext): AnimationPlan[] {
  const ownTriggers = new Set(buildMotionPlans(widget).map((plan) => plan.trigger));
  const plans: AnimationPlan[] = [];
  let currentParentId = widget.parentId;
  const visited = new Set<string>([widget.id]);

  while (currentParentId && !visited.has(currentParentId)) {
    visited.add(currentParentId);
    const parent = context.widgetsById[currentParentId];
    if (!parent) break;
    if (isPassThroughMotionGroup(parent) && parent.motion) {
      const childIndex = parent.childIds?.indexOf(widget.id) ?? 0;
      const delayOffsetMs = childIndex > 0 ? childIndex * readChildCascadeDelayMs(parent) : 0;
      buildMotionPlans(parent).forEach((plan) => {
        if (ownTriggers.has(plan.trigger)) return;
        plans.push(cloneInheritedPlan(plan, widget.id, delayOffsetMs));
      });
    }
    currentParentId = parent.parentId;
  }

  return plans;
}

function buildHoverPlans(widget: WidgetNode): AnimationPlan[] {
  const hoverMotion = resolveWidgetHoverMotion(widget);
  if (!hoverMotion) return [];
  const compositorMotion = hoverMotion.template.buildCompositorMotion(hoverMotion.config);
  const firstKeyframe = compositorMotion.keyframes[0];
  const lastKeyframe = compositorMotion.keyframes[compositorMotion.keyframes.length - 1];
  if (!firstKeyframe || !lastKeyframe) return [];

  const durationMs = Math.max(1, Number(compositorMotion.options.duration ?? DEFAULT_MOTION_DURATION_MS));
  const delayMs = Math.max(0, Number(compositorMotion.options.delay ?? 0));
  const basePlan = {
    id: `${widget.id}:hover:${hoverMotion.template.id}`,
    widgetId: widget.id,
    targetId: widget.id,
    templateId: hoverMotion.template.id,
    phase: 'interaction' as const,
    startMode: 'trigger-local-zero' as const,
    delayMs,
    durationMs,
    fill: 'both' as const,
    replayPolicy: DEFAULT_REPLAY_POLICY,
  };

  return [
    Object.freeze({
      ...basePlan,
      trigger: 'hover-enter' as const,
      iterations: compositorMotion.options.iterations === 'infinite' ? 'infinite' : 1,
      spec: {
        from: toAnimationSpecFrame(firstKeyframe),
        to: toAnimationSpecFrame(lastKeyframe),
        ease: compositorMotion.options.easing ?? 'power2.out',
        willChange: compositorMotion.willChange,
      },
    }),
    Object.freeze({
      ...basePlan,
      trigger: 'hover-exit' as const,
      iterations: 1,
      spec: {
        from: {},
        to: toAnimationSpecFrame(firstKeyframe),
        ease: compositorMotion.options.easing ?? 'power2.out',
        willChange: compositorMotion.willChange,
      },
    }),
  ];
}

export function derivePlansForWidget(widget: WidgetNode, context: PlanContext): readonly AnimationPlan[] {
  const plans = buildHoverPlans(widget);
  plans.push(...buildMotionPlans(widget));
  plans.push(...buildInheritedMotionPlans(widget, context));

  return Object.freeze(plans);
}
