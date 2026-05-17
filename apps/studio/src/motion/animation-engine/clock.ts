import type { AnimationTrigger } from './events';

export type AnimationClockKind = 'scene' | 'event' | 'idle' | 'exit';

export type AnimationStartMode =
  | 'absolute-scene-time'
  | 'trigger-local-zero'
  | 'after-previous'
  | 'with-previous';

export type AnimationClock = {
  readonly kind: AnimationClockKind;
  readonly trigger: AnimationTrigger;
  readonly startMode: AnimationStartMode;
  readonly startedAtMs: number;
};

export const SCENE_CLOCK: AnimationClock = Object.freeze({
  kind: 'scene',
  trigger: 'timeline',
  startMode: 'absolute-scene-time',
  startedAtMs: 0,
});

export function createEventClock(
  trigger: Exclude<AnimationTrigger, 'timeline'>,
  startedAtMs: number,
  kind: Exclude<AnimationClockKind, 'scene'> = 'event',
): AnimationClock {
  return Object.freeze({
    kind,
    trigger,
    startMode: 'trigger-local-zero',
    startedAtMs,
  });
}

export function clockLocalElapsedMs(clock: AnimationClock, nowMs: number): number {
  return Math.max(0, nowMs - clock.startedAtMs);
}
