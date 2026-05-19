import type gsap from 'gsap';
import type { WidgetNode } from '../../domain/document/types';
import type { AnimationClock } from './clock';
import type { AnimationEvent, AnimationEventHandler, AnimationTrigger } from './events';
import type { AnimationPlan, PlanContext } from './plan';

export type AnimationTarget = {
  node: Element;
  widget: WidgetNode;
};

export type Playback = {
  id: string;
  plan: AnimationPlan;
  clock: AnimationClock;
  tl: gsap.core.Timeline;
  cancel(): void;
  pause(): void;
  resume(): void;
};

export type Unsubscribe = () => void;

export interface AnimationEngine {
  buildPlansForWidget(widget: WidgetNode, context: PlanContext): readonly AnimationPlan[];
  play(target: AnimationTarget, plan: AnimationPlan, clock: AnimationClock): Playback;
  cancel(playbackId: string): void;
  cancelAllForWidget(widgetId: string): void;
  emit(event: AnimationEvent): void;
  subscribe(trigger: AnimationTrigger, handler: AnimationEventHandler): Unsubscribe;
  seekScene(playheadMs: number): void;
  syncScenePlayhead(playheadMs: number): void;
  pauseEventClocks(): void;
  resumeEventClocks(): void;
  resetEventClocks(): void;
  getActivePlaybacks(): readonly Playback[];
  hasFiredFor(trigger: AnimationTrigger, sourceId: string): boolean;
  dispose(): void;
}
