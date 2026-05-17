import {
  createEventAnimationClock,
  SCENE_ANIMATION_CLOCK,
  type AnimationClock,
  type AnimationTrigger,
} from './animation-clocks';

export type AnimationEvent = {
  trigger: AnimationTrigger;
  sourceId: string;
  targetId?: string;
  sceneTimeMs: number;
  clock: AnimationClock;
  metadata?: Record<string, unknown>;
};

export type AnimationEventHandler = (event: AnimationEvent) => void;

export function createAnimationEvent(args: {
  trigger: AnimationTrigger;
  sourceId: string;
  targetId?: string;
  sceneTimeMs: number;
  metadata?: Record<string, unknown>;
}): AnimationEvent {
  const clock = args.trigger === 'timeline'
    ? SCENE_ANIMATION_CLOCK
    : createEventAnimationClock(args.trigger, args.sceneTimeMs);
  return {
    trigger: args.trigger,
    sourceId: args.sourceId,
    targetId: args.targetId,
    sceneTimeMs: args.sceneTimeMs,
    clock,
    metadata: args.metadata,
  };
}

export class AnimationEventBus {
  private readonly handlers = new Map<AnimationTrigger, Set<AnimationEventHandler>>();

  subscribe(trigger: AnimationTrigger, handler: AnimationEventHandler): () => void {
    const triggerHandlers = this.handlers.get(trigger) ?? new Set<AnimationEventHandler>();
    triggerHandlers.add(handler);
    this.handlers.set(trigger, triggerHandlers);
    return () => {
      triggerHandlers.delete(handler);
      if (!triggerHandlers.size) this.handlers.delete(trigger);
    };
  }

  emit(event: AnimationEvent): void {
    this.handlers.get(event.trigger)?.forEach((handler) => handler(event));
  }
}
