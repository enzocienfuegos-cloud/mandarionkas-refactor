import gsap from 'gsap';
import { CSSPlugin } from 'gsap/CSSPlugin';
import type { WidgetNode } from '../../domain/document/types';
import type { AnimationClock } from './clock';
import type { AnimationEngine, AnimationTarget, Playback, Unsubscribe } from './engine';
import type { AnimationEvent, AnimationEventHandler, AnimationTrigger } from './events';
import type { AnimationPlan, PlanContext } from './plan';

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

function shouldForce3D(plan: AnimationPlan): boolean {
  return plan.spec.willChange?.includes('transform')
    || 'x' in plan.spec.from
    || 'y' in plan.spec.from
    || 'transform' in plan.spec.from
    || 'x' in plan.spec.to
    || 'y' in plan.spec.to
    || 'transform' in plan.spec.to;
}

export abstract class BaseGsapAnimationEngine implements AnimationEngine {
  protected readonly playbacks = new Map<string, PlaybackRecord>();
  protected readonly playbacksByPlanId = new Map<string, PlaybackRecord>();
  protected readonly queuedByPlanId = new Map<string, QueuedPlayback[]>();
  protected readonly handlers = new Map<AnimationTrigger, Set<AnimationEventHandler>>();
  protected readonly firedByTrigger = new Map<AnimationTrigger, Set<string>>();
  protected scenePlayheadMs = 0;

  abstract buildPlansForWidget(widget: WidgetNode, context: PlanContext): readonly AnimationPlan[];

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
        overwrite: 'auto',
        force3D: shouldForce3D(plan),
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

  /**
   * Forces all scene-clock timelines to the requested playhead.
   * Use only for discrete scrubs/seeks, never on every playback frame.
   */
  seekScene(playheadMs: number): void {
    this.scenePlayheadMs = Math.max(0, playheadMs);
    this.playbacks.forEach((playback) => {
      if (playback.clock.kind !== 'scene') return;
      this.seekPlayback(playback, this.scenePlayheadMs);
    });
  }

  syncScenePlayhead(playheadMs: number): void {
    this.scenePlayheadMs = Math.max(0, playheadMs);
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

  protected seekPlayback(playback: PlaybackRecord, playheadMs: number): void {
    const localMs = Math.max(0, playheadMs - playback.plan.delayMs);
    const finiteDurationMs = playback.plan.durationMs * (playback.plan.iterations === 'infinite' ? 1 : playback.plan.iterations);
    const cappedMs = playback.plan.iterations === 'infinite'
      ? localMs
      : Math.min(localMs, finiteDurationMs);
    playback.tl.seek(cappedMs / 1000, false);
  }

  protected cleanupPlayback(playbackId: string, killTimeline: boolean): void {
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
