import type { AnimationClock } from './clock';

export type AnimationTrigger =
  | 'timeline'
  | 'load'
  | 'scene-enter'
  | 'scene-exit'
  | 'reveal'
  | 'scratch-complete'
  | 'click'
  | 'hover-enter'
  | 'hover-exit'
  | 'completion'
  | 'game-state';

export type AnimationPhase = 'enter' | 'idle' | 'exit' | 'interaction';

export type AnimationEvent = {
  readonly trigger: AnimationTrigger;
  readonly sourceId: string;
  readonly targetId?: string;
  readonly sceneTimeMs: number;
  readonly realTimeMs: number;
  readonly clock: AnimationClock;
  readonly metadata?: Readonly<Record<string, unknown>>;
};

export type AnimationEventHandler = (event: AnimationEvent) => void;
