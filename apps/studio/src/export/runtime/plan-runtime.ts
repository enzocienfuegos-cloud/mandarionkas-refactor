import {
  DEFAULT_MOTION_DELAY_MS,
  DEFAULT_MOTION_DISTANCE_PX,
  DEFAULT_MOTION_DURATION_MS,
  DEFAULT_MOTION_INTENSITY,
} from '../../motion/animation-engine/constants';
import { resolveMotionIterations } from '../../motion/motion-iterations';
import { DEFAULT_REPLAY_POLICY } from '../../motion/animation-engine/replay-policy';
import type { AnimationPlan, AnimationSpec } from '../../motion/animation-engine/plan';
import type { AnimationStartMode } from '../../motion/animation-engine/clock';
import type { AnimationPhase, AnimationTrigger } from '../../motion/animation-engine/events';
import type { ExportRuntimeWidget } from './runtime-model';

function readConfigNumber(config: Record<string, number | string>, key: string, fallback: number): number {
  const value = config[key];
  const numeric = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN;
  return Number.isFinite(numeric) ? numeric : fallback;
}

type RuntimeMotionTemplate = {
  readonly id: string;
  readonly isLoop: boolean;
  buildSpec(config: Record<string, number | string>): AnimationSpec;
};

type RuntimeHoverTemplate = {
  readonly id: string;
  readonly isLoop: boolean;
  buildEnterSpec(config: Record<string, number | string>): AnimationSpec;
  buildExitSpec(config: Record<string, number | string>): AnimationSpec;
};

const RUNTIME_TEMPLATES = new Map<string, RuntimeMotionTemplate>([
  ['appear', {
    id: 'appear',
    isLoop: false,
    buildSpec: () => ({ from: { opacity: 0 }, to: { opacity: 1 }, ease: 'expo.out', willChange: 'opacity' }),
  }],
  ['fade-in', {
    id: 'fade-in',
    isLoop: false,
    buildSpec: () => ({ from: { opacity: 0 }, to: { opacity: 1 }, ease: 'expo.out', willChange: 'opacity' }),
  }],
  ['fade-out', {
    id: 'fade-out',
    isLoop: false,
    buildSpec: () => ({ from: { opacity: 1 }, to: { opacity: 0 }, ease: 'power2.in', willChange: 'opacity' }),
  }],
  ['fade-up', {
    id: 'fade-up',
    isLoop: false,
    buildSpec: (config) => ({
      from: { y: readConfigNumber(config, 'distancePx', DEFAULT_MOTION_DISTANCE_PX), opacity: 0 },
      to: { y: 0, opacity: 1 },
      ease: 'expo.out',
      willChange: 'transform, opacity',
    }),
  }],
  ['float', {
    id: 'float',
    isLoop: true,
    buildSpec: (config) => ({
      from: { y: -readConfigNumber(config, 'distancePx', 8) },
      to: { y: readConfigNumber(config, 'distancePx', 8) },
      ease: 'sine.inOut',
      willChange: 'transform',
    }),
  }],
  ['pulse', {
    id: 'pulse',
    isLoop: true,
    buildSpec: (config) => {
      const intensity = readConfigNumber(config, 'intensity', DEFAULT_MOTION_INTENSITY);
      const lowOpacity = Math.max(0.15, 1 - intensity * 0.45);
      return {
        from: { opacity: 1 },
        to: { opacity: lowOpacity },
        ease: 'sine.inOut',
        willChange: 'opacity',
      };
    },
  }],
  ['slide-in-up', {
    id: 'slide-in-up',
    isLoop: false,
    buildSpec: (config) => ({
      from: { y: readConfigNumber(config, 'distancePx', 80) },
      to: { y: 0 },
      ease: 'expo.out',
      willChange: 'transform',
    }),
  }],
  ['slide-in-down', {
    id: 'slide-in-down',
    isLoop: false,
    buildSpec: (config) => ({
      from: { y: -readConfigNumber(config, 'distancePx', 80) },
      to: { y: 0 },
      ease: 'expo.out',
      willChange: 'transform',
    }),
  }],
  ['slide-in-left', {
    id: 'slide-in-left',
    isLoop: false,
    buildSpec: (config) => ({
      from: { x: -readConfigNumber(config, 'distancePx', 80) },
      to: { x: 0 },
      ease: 'expo.out',
      willChange: 'transform',
    }),
  }],
  ['slide-in-right', {
    id: 'slide-in-right',
    isLoop: false,
    buildSpec: (config) => ({
      from: { x: readConfigNumber(config, 'distancePx', 80) },
      to: { x: 0 },
      ease: 'expo.out',
      willChange: 'transform',
    }),
  }],
]);

const RUNTIME_HOVER_TEMPLATES = new Map<string, RuntimeHoverTemplate>([
  ['lift', {
    id: 'lift',
    isLoop: false,
    buildEnterSpec: (config) => ({
      from: { transform: 'translate3d(0, 0, 0)' },
      to: { transform: `translate3d(0, -${readConfigNumber(config, 'distancePx', 12)}px, 0)` },
      ease: 'power2.out',
      willChange: 'transform',
    }),
    buildExitSpec: () => ({
      from: {},
      to: { transform: 'translate3d(0, 0, 0)' },
      ease: 'power2.out',
      willChange: 'transform',
    }),
  }],
  ['zoom', {
    id: 'zoom',
    isLoop: false,
    buildEnterSpec: (config) => ({
      from: { transform: 'scale(1)' },
      to: { transform: `scale(${readConfigNumber(config, 'scale', 1.05)})` },
      ease: 'power2.out',
      willChange: 'transform',
    }),
    buildExitSpec: () => ({
      from: {},
      to: { transform: 'scale(1)' },
      ease: 'power2.out',
      willChange: 'transform',
    }),
  }],
  ['pulse', {
    id: 'pulse',
    isLoop: true,
    buildEnterSpec: () => ({
      from: { opacity: 1 },
      to: { opacity: 0.7 },
      ease: 'sine.inOut',
      willChange: 'opacity',
    }),
    buildExitSpec: () => ({
      from: {},
      to: { opacity: 1 },
      ease: 'sine.inOut',
      willChange: 'opacity',
    }),
  }],
]);

function buildPlanFromSlot(
  widget: ExportRuntimeWidget,
  slot: NonNullable<ExportRuntimeWidget['motion']>[keyof NonNullable<ExportRuntimeWidget['motion']>],
  phase: Exclude<AnimationPhase, 'interaction'>,
): AnimationPlan | null {
  if (!slot) return null;
  const template = RUNTIME_TEMPLATES.get(slot.templateId);
  if (!template) return null;

  const durationMs = Math.max(1, readConfigNumber(slot.config, 'durationMs', DEFAULT_MOTION_DURATION_MS));
  const rawDelayMs = Math.max(0, readConfigNumber(slot.config, 'delayMs', DEFAULT_MOTION_DELAY_MS));
  const delayMs = slot.trigger === 'timeline' ? widget.timeline.startMs + rawDelayMs : rawDelayMs;
  const startMode: AnimationStartMode = slot.trigger === 'timeline' ? 'absolute-scene-time' : 'trigger-local-zero';

  return Object.freeze({
    id: `${widget.id}:${phase}:${slot.templateId}`,
    widgetId: widget.id,
    targetId: widget.id,
    templateId: slot.templateId,
    trigger: slot.trigger as AnimationTrigger,
    phase,
    startMode,
    delayMs,
    durationMs,
    iterations: resolveMotionIterations(slot.config, template.isLoop ? 'infinite' : 1),
    fill: 'both',
    replayPolicy: slot.replayPolicy ?? DEFAULT_REPLAY_POLICY,
    spec: template.buildSpec(slot.config),
  });
}

function isPassThroughMotionGroup(widget: ExportRuntimeWidget): boolean {
  return widget.type === 'group'
    && Boolean(widget.childIds?.length)
    && !Boolean(widget.props?.scratchEnabled);
}

function readChildCascadeDelayMs(widget: ExportRuntimeWidget): number {
  const raw = Number(widget.props?.childCascadeDelayMs ?? 0);
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

function buildMotionPlans(widget: ExportRuntimeWidget): AnimationPlan[] {
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

function buildHoverPlans(widget: ExportRuntimeWidget): AnimationPlan[] {
  const hoverMotion = widget.hoverMotion;
  if (!hoverMotion?.templateId) return [];
  const template = RUNTIME_HOVER_TEMPLATES.get(hoverMotion.templateId);
  if (!template) return [];
  const durationMs = Math.max(1, readConfigNumber(hoverMotion.config, 'durationMs', DEFAULT_MOTION_DURATION_MS));
  const basePlan = {
    id: `${widget.id}:hover:${hoverMotion.templateId}`,
    widgetId: widget.id,
    targetId: widget.id,
    templateId: hoverMotion.templateId,
    phase: 'interaction' as const,
    startMode: 'trigger-local-zero' as const,
    delayMs: 0,
    durationMs,
    fill: 'both' as const,
    replayPolicy: DEFAULT_REPLAY_POLICY,
  };
  return [
    Object.freeze({
      ...basePlan,
      trigger: 'hover-enter' as const,
      iterations: template.isLoop ? 'infinite' : 1,
      spec: template.buildEnterSpec(hoverMotion.config),
    }),
    Object.freeze({
      ...basePlan,
      trigger: 'hover-exit' as const,
      iterations: 1,
      spec: template.buildExitSpec(hoverMotion.config),
    }),
  ];
}

function buildInheritedMotionPlans(
  widget: ExportRuntimeWidget,
  context: { readonly widgetsById: Readonly<Record<string, ExportRuntimeWidget>>; readonly previewMode: boolean },
): AnimationPlan[] {
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

export function derivePlansForRuntimeWidget(
  widget: ExportRuntimeWidget,
  context: { readonly widgetsById: Readonly<Record<string, ExportRuntimeWidget>>; readonly previewMode: boolean },
): readonly AnimationPlan[] {
  const plans = buildHoverPlans(widget);
  plans.push(...buildMotionPlans(widget));
  plans.push(...buildInheritedMotionPlans(widget, context));

  return Object.freeze(plans);
}
