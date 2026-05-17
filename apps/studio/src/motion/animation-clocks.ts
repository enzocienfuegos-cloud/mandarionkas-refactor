import type { WidgetNode } from '../domain/document/types';

export type AnimationTrigger =
  | 'timeline'
  | 'load'
  | 'scratch-complete'
  | 'reveal'
  | 'click'
  | 'hover'
  | 'completion'
  | 'game-state';

export type AnimationPhase = 'enter' | 'idle' | 'exit' | 'interaction';

export type AnimationStartMode =
  | 'absolute-scene-time'
  | 'trigger-local-zero'
  | 'after-previous'
  | 'with-previous';

export type AnimationClockKind = 'scene' | 'event' | 'idle' | 'exit';

export type AnimationClock = {
  kind: AnimationClockKind;
  trigger: AnimationTrigger;
  startMode: AnimationStartMode;
  startedAtMs?: number;
};

export type AnimationPlan = {
  id: string;
  widgetId: string;
  targetId: string;
  templateId: string;
  trigger: AnimationTrigger;
  phase: AnimationPhase;
  startMode: AnimationStartMode;
  delayMs: number;
  durationMs: number;
  iterations?: number | 'infinite';
  fill?: FillMode;
  inheritToChildren?: boolean;
};

export const SCENE_ANIMATION_CLOCK: AnimationClock = {
  kind: 'scene',
  trigger: 'timeline',
  startMode: 'absolute-scene-time',
};

export function createEventAnimationClock(
  trigger: Exclude<AnimationTrigger, 'timeline'>,
  startedAtMs: number,
  kind: Exclude<AnimationClockKind, 'scene'> = 'event',
): AnimationClock {
  return {
    kind,
    trigger,
    startMode: 'trigger-local-zero',
    startedAtMs,
  };
}

export function createRevealAnimationClock(startedAtMs: number): AnimationClock {
  return createEventAnimationClock('reveal', startedAtMs);
}

export function isEventDrivenClock(clock: AnimationClock | undefined): boolean {
  return Boolean(clock && clock.kind !== 'scene' && clock.startMode === 'trigger-local-zero');
}

export function getAnimationClockSignature(clock: AnimationClock | undefined): string {
  const targetClock = clock ?? SCENE_ANIMATION_CLOCK;
  return [
    targetClock.kind,
    targetClock.trigger,
    targetClock.startMode,
    Number.isFinite(targetClock.startedAtMs) ? Number(targetClock.startedAtMs) : '',
  ].join(':');
}

export function resolveClockLocalMs(
  clock: AnimationClock | undefined,
  scenePlayheadMs: number,
  timelineStartMs = 0,
): number {
  const targetClock = clock ?? SCENE_ANIMATION_CLOCK;
  if (!isEventDrivenClock(targetClock)) {
    return Math.max(0, scenePlayheadMs - timelineStartMs);
  }
  return Math.max(0, scenePlayheadMs - Number(targetClock.startedAtMs ?? scenePlayheadMs));
}

export function resolveTimelinePlayheadForClock(
  widget: Pick<WidgetNode, 'timeline'>,
  scenePlayheadMs: number,
  clock: AnimationClock | undefined,
): number {
  const targetClock = clock ?? SCENE_ANIMATION_CLOCK;
  if (!isEventDrivenClock(targetClock)) return scenePlayheadMs;
  return widget.timeline.startMs + resolveClockLocalMs(targetClock, scenePlayheadMs, widget.timeline.startMs);
}

export function buildTimelineAnimationPlan(widget: WidgetNode): AnimationPlan | null {
  if (!widget.motion?.templateId) return null;
  const durationMs = Math.max(1, Number(widget.motion.config?.durationMs ?? widget.timeline.endMs - widget.timeline.startMs));
  const delayMs = Math.max(0, Number(widget.motion.config?.delayMs ?? 0));
  return {
    id: `${widget.id}:motion:${widget.motion.templateId}:timeline`,
    widgetId: widget.id,
    targetId: widget.id,
    templateId: widget.motion.templateId,
    trigger: 'timeline',
    phase: widget.motion.templateId === 'fade-out' ? 'exit' : 'enter',
    startMode: 'absolute-scene-time',
    delayMs,
    durationMs,
    fill: 'both',
  };
}

export function buildRevealAnimationPlan(widget: WidgetNode, inheritToChildren = false): AnimationPlan | null {
  if (!widget.motion?.templateId) return null;
  const durationMs = Math.max(1, Number(widget.motion.config?.durationMs ?? widget.timeline.endMs - widget.timeline.startMs));
  const delayMs = Math.max(0, Number(widget.motion.config?.delayMs ?? 0));
  const iterations = widget.motion.templateId === 'float' || widget.motion.templateId === 'pulse'
    ? 'infinite'
    : undefined;
  return {
    id: `${widget.id}:motion:${widget.motion.templateId}:reveal`,
    widgetId: widget.id,
    targetId: widget.id,
    templateId: widget.motion.templateId,
    trigger: 'reveal',
    phase: iterations === 'infinite' ? 'idle' : 'enter',
    startMode: 'trigger-local-zero',
    delayMs,
    durationMs,
    iterations,
    fill: 'both',
    inheritToChildren,
  };
}
