import gsap from 'gsap';
import { CSSPlugin } from 'gsap/CSSPlugin';
import type { WidgetNode } from '../../domain/document/types';
import type { AnimationClock } from '../../motion/animation-engine/clock';
import type { AnimationEngine, AnimationTarget, Playback, Unsubscribe } from '../../motion/animation-engine/engine';
import type { AnimationEvent, AnimationEventHandler, AnimationTrigger } from '../../motion/animation-engine/events';
import type { AnimationPlan, PlanContext } from '../../motion/animation-engine/plan';

gsap.registerPlugin(CSSPlugin);

type PlaybackRecord = Playback & {
  readonly widgetId: string;
  readonly targetNode: Element;
  completed: boolean;
  restoreWillChange?: string;
};

type QueuedPlayback = {
  target: AnimationTarget;
  plan: AnimationPlan;
  clock: AnimationClock;
};

function isLoopPlayback(plan: AnimationPlan): boolean {
  return plan.iterations === 'infinite';
}

function resolveRepeat(plan: AnimationPlan): number {
  if (plan.iterations === 'infinite') return -1;
  return Math.max(0, plan.iterations - 1);
}

export class RuntimeAnimationEngine implements AnimationEngine {
  private readonly playbacks = new Map<string, PlaybackRecord>();
  private readonly playbacksByPlanId = new Map<string, PlaybackRecord>();
  private readonly queuedByPlanId = new Map<string, QueuedPlayback[]>();
  private readonly handlers = new Map<AnimationTrigger, Set<AnimationEventHandler>>();
  private readonly firedByTrigger = new Map<AnimationTrigger, Set<string>>();
  private scenePlayheadMs = 0;

  buildPlansForWidget(_widget: WidgetNode, _context: PlanContext): readonly AnimationPlan[] {
    return [];
  }

  play(target: AnimationTarget, plan: AnimationPlan, clock: AnimationClock): Playback {
    const existing = this.playbacksByPlanId.get(plan.id);
    if (plan.replayPolicy === 'ignore' && existing && !existing.completed) {
      return existing;
    }
    if (plan.replayPolicy === 'queue' && existing && !existing.completed) {
      const queue = this.queuedByPlanId.get(plan.id) ?? [];
      queue.push({ target, plan, clock });
      this.queuedByPlanId.set(plan.id, queue);
      return existing;
    }
    if (existing) {
      existing.cancel();
    }

    const tl = gsap.timeline({ paused: true });
    const playbackId = `${plan.id}@${clock.startedAtMs}`;
    const node = target.node as HTMLElement;
    const previousWillChange = node.style.willChange;
    if (plan.spec.willChange) {
      node.style.willChange = plan.spec.willChange;
    }

    tl.fromTo(
      target.node,
      { ...plan.spec.from, transformOrigin: plan.spec.transformOrigin },
      {
        ...plan.spec.to,
        duration: plan.durationMs / 1000,
        delay: plan.delayMs / 1000,
        ease: plan.spec.ease,
        repeat: resolveRepeat(plan),
        yoyo: isLoopPlayback(plan),
        immediateRender: false,
      },
    );

    const record: PlaybackRecord = {
      id: playbackId,
      plan,
      clock,
      tl,
      widgetId: target.widget.id,
      targetNode: target.node,
      completed: false,
      restoreWillChange: previousWillChange,
      cancel: () => {
        this.cleanupPlayback(playbackId, true);
      },
      pause: () => {
        tl.pause();
      },
      resume: () => {
        tl.resume();
      },
    };

    tl.eventCallback('onComplete', () => {
      record.completed = true;
      this.cleanupPlayback(playbackId, false);
      const queue = this.queuedByPlanId.get(plan.id);
      const next = queue?.shift();
      if (!queue?.length) this.queuedByPlanId.delete(plan.id);
      if (next) {
        this.play(next.target, next.plan, next.clock);
      }
    });

    this.playbacks.set(playbackId, record);
    this.playbacksByPlanId.set(plan.id, record);
    tl.play(0);
    if (clock.kind === 'scene') {
      this.seekPlayback(record, this.scenePlayheadMs);
    }
    return record;
  }

  cancel(playbackId: string): void {
    this.cleanupPlayback(playbackId, true);
  }

  cancelAllForWidget(widgetId: string): void {
    [...this.playbacks.values()]
      .filter((playback) => playback.widgetId === widgetId)
      .forEach((playback) => playback.cancel());
  }

  emit(event: AnimationEvent): void {
    const fired = this.firedByTrigger.get(event.trigger) ?? new Set<string>();
    fired.add(event.sourceId);
    this.firedByTrigger.set(event.trigger, fired);
    this.handlers.get(event.trigger)?.forEach((handler) => handler(event));
  }

  subscribe(trigger: AnimationTrigger, handler: AnimationEventHandler): Unsubscribe {
    const handlers = this.handlers.get(trigger) ?? new Set<AnimationEventHandler>();
    handlers.add(handler);
    this.handlers.set(trigger, handlers);
    return () => {
      handlers.delete(handler);
      if (!handlers.size) {
        this.handlers.delete(trigger);
      }
    };
  }

  seekScene(playheadMs: number): void {
    this.scenePlayheadMs = Math.max(0, playheadMs);
    this.playbacks.forEach((playback) => {
      if (playback.clock.kind !== 'scene') return;
      this.seekPlayback(playback, this.scenePlayheadMs);
    });
  }

  pauseEventClocks(): void {
    this.playbacks.forEach((playback) => {
      if (playback.clock.kind === 'scene') return;
      playback.pause();
    });
  }

  resumeEventClocks(): void {
    this.playbacks.forEach((playback) => {
      if (playback.clock.kind === 'scene') return;
      playback.resume();
    });
  }

  resetEventClocks(): void {
    this.firedByTrigger.clear();
    [...this.playbacks.values()]
      .filter((playback) => playback.clock.kind !== 'scene')
      .forEach((playback) => playback.cancel());
  }

  getActivePlaybacks(): readonly Playback[] {
    return [...this.playbacks.values()];
  }

  hasFiredFor(trigger: AnimationTrigger, sourceId: string): boolean {
    return this.firedByTrigger.get(trigger)?.has(sourceId) ?? false;
  }

  dispose(): void {
    [...this.playbacks.keys()].forEach((playbackId) => this.cleanupPlayback(playbackId, true));
    this.handlers.clear();
    this.firedByTrigger.clear();
    this.queuedByPlanId.clear();
  }

  private seekPlayback(playback: PlaybackRecord, playheadMs: number): void {
    const localMs = Math.max(0, playheadMs - playback.plan.delayMs);
    const finiteDurationMs = playback.plan.durationMs * (playback.plan.iterations === 'infinite' ? 1 : playback.plan.iterations);
    const cappedMs = playback.plan.iterations === 'infinite'
      ? localMs
      : Math.min(localMs, finiteDurationMs);
    playback.tl.seek(cappedMs / 1000, false);
  }

  private cleanupPlayback(playbackId: string, killTimeline: boolean): void {
    const playback = this.playbacks.get(playbackId);
    if (!playback) return;
    this.playbacks.delete(playbackId);
    if (this.playbacksByPlanId.get(playback.plan.id)?.id === playbackId) {
      this.playbacksByPlanId.delete(playback.plan.id);
    }
    if (killTimeline) {
      playback.tl.kill();
    }
    const node = playback.targetNode;
    if (node instanceof HTMLElement) {
      node.style.willChange = playback.restoreWillChange ?? '';
    }
  }
}
