import gsap from 'gsap';
import { SCENE_CLOCK, createEventClock, type AnimationClock } from '../../motion/animation-engine/clock';
import type { AnimationEngine, AnimationTarget } from '../../motion/animation-engine/engine';
import type { AnimationTrigger } from '../../motion/animation-engine/events';
import { buildRevealReplayPlan, shouldReplayLoadMotionOnReveal } from '../../motion/animation-engine/reveal-replay';
import { derivePlansForRuntimeWidget } from './plan-runtime';
import type { ExportRuntimeModel, ExportRuntimeScene, ExportRuntimeWidget } from './runtime-model';
import type { SceneManager } from './scene-manager';

type WidgetMotionMount = {
  dispose(): void;
};

const EVENT_TRIGGERS: readonly AnimationTrigger[] = [
  'load',
  'scene-enter',
  'scene-exit',
  'reveal',
  'scratch-complete',
  'click',
  'hover-enter',
  'hover-exit',
];

function findMotionNode(widgetId: string): HTMLElement | null {
  return document.querySelector(`[data-widget-layer-id="${widgetId}"]`)
    ?? document.querySelector(`[data-widget-id="${widgetId}"]`);
}

function buildWidgetIndex(runtimeModel: ExportRuntimeModel): Record<string, ExportRuntimeWidget> {
  return Object.fromEntries(
    runtimeModel.scenes.flatMap((scene) => scene.widgets.map((widget) => [widget.id, widget] as const)),
  );
}

function isCoveredByScratchGroup(scene: ExportRuntimeScene, scratchWidget: ExportRuntimeWidget, widget: ExportRuntimeWidget): boolean {
  if (scratchWidget.id === widget.id) return false;
  const targetMode = String(scratchWidget.props?.revealTargetMode ?? 'auto').trim().toLowerCase();
  const targetId = String(scratchWidget.props?.revealTargetId ?? '').trim();
  const scratchSceneWidgetsById = Object.fromEntries(scene.widgets.map((entry) => [entry.id, entry] as const));
  if (targetMode === 'scene') return widget.sceneId === targetId;
  if (targetMode === 'widget' && targetId) {
    if (widget.id === targetId) return true;
    let currentParentId = widget.parentId;
    const visited = new Set<string>();
    while (currentParentId && !visited.has(currentParentId)) {
      if (currentParentId === targetId) return true;
      visited.add(currentParentId);
      currentParentId = scratchSceneWidgetsById[currentParentId]?.parentId;
    }
    return false;
  }
  let scratchParentId = widget.parentId;
  const scratchVisited = new Set<string>();
  while (scratchParentId && !scratchVisited.has(scratchParentId)) {
    if (scratchParentId === scratchWidget.id) return false;
    scratchVisited.add(scratchParentId);
    scratchParentId = scratchSceneWidgetsById[scratchParentId]?.parentId;
  }
  if (targetMode !== 'auto') return false;
  if (Number(scratchWidget.zIndex ?? 0) <= Number(widget.zIndex ?? 0)) return false;
  const left = scratchWidget.frame;
  const right = widget.frame;
  return Number(left.x ?? 0) < Number(right.x ?? 0) + Number(right.width ?? 0)
    && Number(left.x ?? 0) + Number(left.width ?? 0) > Number(right.x ?? 0)
    && Number(left.y ?? 0) < Number(right.y ?? 0) + Number(right.height ?? 0)
    && Number(left.y ?? 0) + Number(left.height ?? 0) > Number(right.y ?? 0);
}

function isWaitingForScratchReveal(scene: ExportRuntimeScene, widget: ExportRuntimeWidget): boolean {
  const completionMap = (window as Window & typeof globalThis & {
    __smxScratchCompletionMsByWidgetId?: Record<string, number>;
  }).__smxScratchCompletionMsByWidgetId ?? {};
  return scene.widgets.some((candidate) => {
    if (!candidate.props?.scratchEnabled || candidate.type !== 'group') return false;
    if (Number.isFinite(Number(completionMap[candidate.id]))) return false;
    return isCoveredByScratchGroup(scene, candidate, widget);
  });
}

function syncTimelineWidget(widget: ExportRuntimeWidget, playheadMs: number): void {
  const node = document.querySelector(`[data-widget-id="${widget.id}"]`);
  if (!(node instanceof HTMLElement)) return;
  const keyframes = [...(widget.timeline.keyframes ?? [])].sort((left, right) => left.atMs - right.atMs);
  if (!keyframes.length) return;

  const readTrackValue = (
    property: 'x' | 'y' | 'width' | 'height' | 'opacity',
    fallback: number,
  ): number => {
    const track = keyframes.filter((keyframe) => keyframe.property === property);
    if (!track.length) return fallback;
    const before = [...track].reverse().find((keyframe) => keyframe.atMs <= playheadMs) ?? track[0];
    const after = track.find((keyframe) => keyframe.atMs >= playheadMs) ?? track[track.length - 1];
    if (before.atMs === after.atMs) return Number(before.value ?? fallback);
    const progress = Math.max(0, Math.min(1, (playheadMs - before.atMs) / Math.max(1, after.atMs - before.atMs)));
    const eased = after.easing === 'ease-in'
      ? progress * progress
      : after.easing === 'ease-out'
        ? 1 - (1 - progress) * (1 - progress)
        : after.easing === 'ease-in-out'
          ? progress < 0.5 ? 2 * progress * progress : 1 - ((-2 * progress + 2) ** 2) / 2
          : progress;
    return Number(before.value ?? fallback) + (Number(after.value ?? fallback) - Number(before.value ?? fallback)) * eased;
  };

  node.style.left = `${readTrackValue('x', widget.frame.x)}px`;
  node.style.top = `${readTrackValue('y', widget.frame.y)}px`;
  node.style.width = `${readTrackValue('width', widget.frame.width)}px`;
  node.style.height = `${readTrackValue('height', widget.frame.height)}px`;
  node.style.opacity = `${readTrackValue('opacity', Number(widget.style.opacity ?? 1))}`;
}

function mountTimelineWidgets(runtimeModel: ExportRuntimeModel, sceneManager: SceneManager): () => void {
  const sceneWidgetsById = buildWidgetIndex(runtimeModel);
  const tick = (): void => {
    const scene = sceneManager.getActiveScene();
    if (!scene) return;
    const elapsedMs = sceneManager.getSceneElapsedMs();
    scene.widgets.forEach((widget) => {
      if (!(widget.timeline.keyframes?.length)) return;
      const revealStartedAt = Number((window as Window & typeof globalThis & {
        __smxScratchCompletionMsByWidgetId?: Record<string, number>;
      }).__smxScratchCompletionMsByWidgetId?.[
        scene.widgets.find((candidate) => candidate.type === 'group' && candidate.props?.scratchEnabled && isCoveredByScratchGroup(scene, candidate, widget))?.id ?? ''
      ]);
      if (Number.isFinite(revealStartedAt)) {
        const localElapsedMs = widget.timeline.startMs + Math.max(0, elapsedMs - revealStartedAt);
        syncTimelineWidget(sceneWidgetsById[widget.id], localElapsedMs);
        return;
      }
      syncTimelineWidget(sceneWidgetsById[widget.id], elapsedMs);
    });
  };

  gsap.ticker.add(tick);
  tick();
  return () => {
    gsap.ticker.remove(tick);
  };
}

function resolveClock(trigger: AnimationTrigger, event: { clock: AnimationClock }): AnimationClock {
  if (trigger === 'timeline') return SCENE_CLOCK;
  return event.clock;
}

function bindPointerDrivenTriggers(engine: AnimationEngine, widget: ExportRuntimeWidget, targetNode: HTMLElement): Array<() => void> {
  const bindings: Array<{ eventName: keyof HTMLElementEventMap; trigger: 'click' | 'hover-enter' | 'hover-exit' }> = [
    { eventName: 'click', trigger: 'click' },
    { eventName: 'pointerenter', trigger: 'hover-enter' },
    { eventName: 'pointerleave', trigger: 'hover-exit' },
  ];
  return bindings.map(({ eventName, trigger }) => {
    const handler = (): void => {
      const realTimeMs = typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now();
      engine.emit({
        trigger,
        sourceId: widget.id,
        targetId: widget.id,
        sceneTimeMs: 0,
        realTimeMs,
        clock: createEventClock(trigger, realTimeMs),
      });
    };
    targetNode.addEventListener(eventName, handler);
    return () => targetNode.removeEventListener(eventName, handler);
  });
}

export function mountWidgetMotions(
  runtimeModel: ExportRuntimeModel,
  engine: AnimationEngine,
  sceneManager: SceneManager,
): WidgetMotionMount {
  const widgetsById = buildWidgetIndex(runtimeModel);
  const unsubscribes: Array<() => void> = [];

  runtimeModel.scenes.forEach((scene) => {
    scene.widgets.forEach((widget) => {
      const motionTargetNode = findMotionNode(widget.id);
      if (!motionTargetNode) return;
      const plans = derivePlansForRuntimeWidget(widget, { widgetsById, previewMode: false });
      const target: AnimationTarget = { node: motionTargetNode, widget: { ...widget, name: widget.id } };

      EVENT_TRIGGERS.forEach((trigger) => {
        unsubscribes.push(engine.subscribe(trigger, (event) => {
          if (event.targetId !== widget.id) return;
          const eventPlans = plans
            .filter((plan) => plan.trigger === trigger)
            .concat(
              trigger === 'reveal'
                ? plans
                  .filter((plan) => plan.trigger === 'timeline' || (shouldReplayLoadMotionOnReveal(event) && plan.trigger === 'load'))
                  .map((plan) => buildRevealReplayPlan(plan, widget.timeline.startMs))
                : [],
            );

          eventPlans.forEach((plan) => {
            engine.play(target, plan, resolveClock(plan.trigger, event));
          });

          if (trigger === 'scene-enter') {
            plans
              .filter((plan) => plan.trigger === 'timeline')
              .forEach((plan) => {
                if (isWaitingForScratchReveal(scene, widget)) return;
                engine.play(target, plan, SCENE_CLOCK);
                engine.seekScene(sceneManager.getSceneElapsedMs());
              });
          }
        }));
      });

      bindPointerDrivenTriggers(engine, widget, motionTargetNode).forEach((unsubscribe) => unsubscribes.push(unsubscribe));
    });
  });

  const disposeTimeline = mountTimelineWidgets(runtimeModel, sceneManager);

  return {
    dispose: () => {
      unsubscribes.forEach((unsubscribe) => unsubscribe());
      disposeTimeline();
    },
  };
}
