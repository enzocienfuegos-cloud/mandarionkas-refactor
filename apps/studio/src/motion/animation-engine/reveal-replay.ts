import type { AnimationEvent } from './events';
import type { AnimationPlan } from './plan';

export const SCRATCH_REPLAY_TARGET_MOTION_ON_REVEAL_METADATA_KEY = 'scratchReplayTargetMotionOnReveal';

export function shouldReplayLoadMotionOnReveal(event: Pick<AnimationEvent, 'trigger' | 'metadata'>): boolean {
  if (event.trigger !== 'reveal') return false;
  return event.metadata?.[SCRATCH_REPLAY_TARGET_MOTION_ON_REVEAL_METADATA_KEY] === true;
}

export function buildScratchRevealMetadata(enabled: boolean): Readonly<Record<string, unknown>> | undefined {
  if (!enabled) return undefined;
  return Object.freeze({
    [SCRATCH_REPLAY_TARGET_MOTION_ON_REVEAL_METADATA_KEY]: true,
  });
}

export function buildRevealReplayPlan(plan: AnimationPlan, widgetTimelineStartMs: number): AnimationPlan {
  const delayMs = plan.trigger === 'timeline'
    ? Math.max(0, plan.delayMs - widgetTimelineStartMs)
    : Math.max(0, plan.delayMs);

  return Object.freeze({
    ...plan,
    id: `${plan.id}:reveal`,
    trigger: 'reveal',
    startMode: 'trigger-local-zero',
    delayMs,
  });
}
