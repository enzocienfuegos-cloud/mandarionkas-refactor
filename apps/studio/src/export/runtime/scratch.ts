import { createEventClock } from '../../motion/animation-engine/clock';
import type { AnimationEngine } from '../../motion/animation-engine/engine';
import { buildScratchRevealMetadata } from '../../motion/animation-engine/reveal-replay';
import {
  DEFAULT_SCRATCH_AUTO_REVEAL_THRESHOLD,
  type ScratchMilestone,
} from '../../widgets/group/group-scratch-constants';
import {
  createScratchMaskEngine,
  initializeScratchPathElement,
  type ScratchMaskEngine,
} from '../../widgets/group/scratch-mask-engine';
import type { ExportRuntimeModel, ExportRuntimeScene, ExportRuntimeWidget } from './runtime-model';
import type { SceneManager } from './scene-manager';

type ScratchMilestoneTrigger = Exclude<ScratchMilestone['emitTrigger'], 'timeline'>;

type ScratchRuntimeWindow = Window & typeof globalThis & {
  __smxScratchCompletionMsByWidgetId?: Record<string, number>;
  __smxScratchCompletionPerfMsByWidgetId?: Record<string, number>;
};

function nowMs(): number {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}

function rectsOverlap(left: ExportRuntimeWidget['frame'], right: ExportRuntimeWidget['frame']): boolean {
  return Number(left.x ?? 0) < Number(right.x ?? 0) + Number(right.width ?? 0)
    && Number(left.x ?? 0) + Number(left.width ?? 0) > Number(right.x ?? 0)
    && Number(left.y ?? 0) < Number(right.y ?? 0) + Number(right.height ?? 0)
    && Number(left.y ?? 0) + Number(left.height ?? 0) > Number(right.y ?? 0);
}

function isRuntimeWidgetDescendantOf(scene: ExportRuntimeScene, widget: ExportRuntimeWidget, ancestorWidgetId: string): boolean {
  const widgetsById = Object.fromEntries(scene.widgets.map((entry) => [entry.id, entry] as const));
  let currentParentId = widget.parentId;
  const visited = new Set<string>();
  while (currentParentId && !visited.has(currentParentId)) {
    if (currentParentId === ancestorWidgetId) return true;
    visited.add(currentParentId);
    currentParentId = widgetsById[currentParentId]?.parentId;
  }
  return false;
}

function isCoveredByScratchGroup(scene: ExportRuntimeScene, scratchWidget: ExportRuntimeWidget, widget: ExportRuntimeWidget): boolean {
  if (scratchWidget.id === widget.id) return false;
  const targetMode = String(scratchWidget.props?.revealTargetMode ?? 'auto').trim().toLowerCase();
  const targetId = String(scratchWidget.props?.revealTargetId ?? '').trim();
  if (targetMode === 'scene') return widget.sceneId === targetId;
  if (targetMode === 'widget' && targetId) {
    return widget.id === targetId || isRuntimeWidgetDescendantOf(scene, widget, targetId);
  }
  if (isRuntimeWidgetDescendantOf(scene, widget, scratchWidget.id)) return false;
  if (targetMode !== 'auto') return false;
  if (Number(scratchWidget.zIndex ?? 0) <= Number(widget.zIndex ?? 0)) return false;
  return rectsOverlap(scratchWidget.frame, widget.frame);
}

function isVisuallyCoveredByScratchShell(scene: ExportRuntimeScene, scratchWidget: ExportRuntimeWidget, widget: ExportRuntimeWidget): boolean {
  if (scratchWidget.id === widget.id) return false;
  if (isRuntimeWidgetDescendantOf(scene, widget, scratchWidget.id)) return false;
  if (Number(scratchWidget.zIndex ?? 0) <= Number(widget.zIndex ?? 0)) return false;
  return rectsOverlap(scratchWidget.frame, widget.frame);
}

function resolveScratchScene(runtimeModel: ExportRuntimeModel, scratchWidgetId: string): ExportRuntimeScene | null {
  return runtimeModel.scenes.find((scene) => scene.widgets.some((widget) => widget.id === scratchWidgetId)) ?? null;
}

function resolveScratchTargets(scene: ExportRuntimeScene, scratchWidget: ExportRuntimeWidget): ExportRuntimeWidget[] {
  return scene.widgets.filter((widget) => isCoveredByScratchGroup(scene, scratchWidget, widget));
}

function resolveCoveredScratchWidgets(scene: ExportRuntimeScene, scratchWidget: ExportRuntimeWidget): ExportRuntimeWidget[] {
  return scene.widgets.filter((widget) => isVisuallyCoveredByScratchShell(scene, scratchWidget, widget));
}

function resolveScratchSubtreeWidgets(scene: ExportRuntimeScene, scratchWidget: ExportRuntimeWidget): ExportRuntimeWidget[] {
  const widgetsById = Object.fromEntries(scene.widgets.map((entry) => [entry.id, entry] as const));
  const visited = new Set<string>();
  const result: ExportRuntimeWidget[] = [];

  const visit = (widgetId: string): void => {
    if (visited.has(widgetId)) return;
    visited.add(widgetId);
    const widget = widgetsById[widgetId];
    if (!widget) return;
    result.push(widget);
    (widget.childIds ?? []).forEach(visit);
  };

  visit(scratchWidget.id);
  return result;
}

function resolveScratchInternalTargetIds(scene: ExportRuntimeScene, scratchWidget: ExportRuntimeWidget): Set<string> {
  const targetMode = String(scratchWidget.props?.revealTargetMode ?? 'auto').trim().toLowerCase();
  const targetId = String(scratchWidget.props?.revealTargetId ?? '').trim();
  if (targetMode !== 'widget' || !targetId) return new Set<string>();

  const widgetsById = Object.fromEntries(scene.widgets.map((entry) => [entry.id, entry] as const));
  const targetWidget = widgetsById[targetId];
  if (!targetWidget || !isRuntimeWidgetDescendantOf(scene, targetWidget, scratchWidget.id)) return new Set<string>();

  const subtreeIds = new Set<string>();
  const visited = new Set<string>();
  const visit = (widgetId: string): void => {
    if (visited.has(widgetId)) return;
    visited.add(widgetId);
    const widget = widgetsById[widgetId];
    if (!widget) return;
    subtreeIds.add(widget.id);
    (widget.childIds ?? []).forEach(visit);
  };

  visit(targetId);
  return subtreeIds;
}

function findRuntimeWidgetNodes(widgetId: string): HTMLElement[] {
  return [
    ...document.querySelectorAll<HTMLElement>(`[data-widget-id="${widgetId}"]`),
    ...document.querySelectorAll<HTMLElement>(`[data-widget-layer-id="${widgetId}"]`),
  ];
}

export function mountScratchReveal(
  engine: AnimationEngine,
  runtimeModel: ExportRuntimeModel,
  sceneManager: SceneManager,
): { dispose(): void } {
  const runtimeWindow = window as ScratchRuntimeWindow;
  runtimeWindow.__smxScratchCompletionMsByWidgetId = runtimeWindow.__smxScratchCompletionMsByWidgetId ?? {};
  runtimeWindow.__smxScratchCompletionPerfMsByWidgetId = runtimeWindow.__smxScratchCompletionPerfMsByWidgetId ?? {};
  const removers: Array<() => void> = [];
  const visibilitySnapshots = new Map<HTMLElement, { display: string; visibility: string; pointerEvents: string }>();

  document.querySelectorAll<HTMLElement>('[data-scratch-shell]').forEach((shellNode) => {
    const root = shellNode.closest<HTMLElement>('[data-widget-id]') ?? shellNode.parentElement;
    if (!root) return;
    const shell = shellNode;
    const maskRect = root.querySelector<SVGRectElement>('[data-scratch-mask-rect]');
    const maskPath = root.querySelector<SVGPathElement>('[data-scratch-mask-path]');
    const maskTarget = root.querySelector<HTMLElement>('[data-scratch-mask-target]');
    const canvas = root.querySelector<HTMLCanvasElement>('[data-scratch-canvas]');
    if (!canvas) return;

    const width = Math.max(1, shell.clientWidth || shell.offsetWidth || canvas.width);
    const height = Math.max(1, shell.clientHeight || shell.offsetHeight || canvas.height);
    canvas.width = width;
    canvas.height = height;
    const scratchWidgetId = root.getAttribute('data-scratch-widget-id') || root.getAttribute('data-widget-id') || '';
    maskRect?.setAttribute('width', `${width}`);
    maskRect?.setAttribute('height', `${height}`);

    const scratchRadius = Math.max(4, Number(shell.getAttribute('data-scratch-radius') || root.getAttribute('data-scratch-radius') || 18));
    const thresholdValue = shell.getAttribute('data-scratch-auto-reveal-threshold')
      || shell.getAttribute('data-scratch-threshold')
      || root.getAttribute('data-scratch-auto-reveal-threshold')
      || root.getAttribute('data-scratch-threshold')
      || String(DEFAULT_SCRATCH_AUTO_REVEAL_THRESHOLD);
    const completeThreshold = Math.max(0, Math.min(100, Number(thresholdValue)));
    const milestonesAttr = shell.getAttribute('data-scratch-milestones') || '[]';
    let milestones: ScratchMilestone[] = [];
    try {
      const parsed = JSON.parse(milestonesAttr) as unknown;
      if (Array.isArray(parsed)) {
        milestones = parsed
          .filter((entry): entry is ScratchMilestone => Boolean(
            entry
              && typeof entry === 'object'
              && typeof (entry as ScratchMilestone).id === 'string'
              && Number.isFinite(Number((entry as ScratchMilestone).thresholdPercent))
              && typeof (entry as ScratchMilestone).emitTrigger === 'string',
          ))
          .map((entry) => ({
            id: entry.id,
            thresholdPercent: Math.max(1, Math.min(99, Number(entry.thresholdPercent))),
            emitTrigger: entry.emitTrigger,
          }))
          .sort((left, right) => left.thresholdPercent - right.thresholdPercent);
      }
    } catch {
      milestones = [];
    }
    const activationDelayMs = Math.max(0, Number(shell.getAttribute('data-scratch-activation-delay') || root.getAttribute('data-scratch-activation-delay') || 0));
    const revealTargetMode = (shell.getAttribute('data-scratch-reveal-target-mode')
      || root.getAttribute('data-scratch-reveal-target-mode')
      || 'auto').trim().toLowerCase();
    const revealTargetId = (shell.getAttribute('data-scratch-reveal-target-id')
      || root.getAttribute('data-scratch-reveal-target-id')
      || '').trim();

    let scratchReady = activationDelayMs <= 0;
    if (!scratchReady) {
      shell.setAttribute('data-scratch-ready', 'false');
      window.setTimeout(() => {
        scratchReady = true;
        shell.setAttribute('data-scratch-ready', 'true');
      }, activationDelayMs);
    } else {
      shell.setAttribute('data-scratch-ready', 'true');
    }
    initializeScratchPathElement(maskPath, scratchRadius);

    const startedAt = nowMs();
    const scene = resolveScratchScene(runtimeModel, scratchWidgetId);
    const scratchWidget = scene?.widgets.find((widget) => widget.id === scratchWidgetId);
    const replayTargetMotionOnReveal = (shell.getAttribute('data-scratch-replay-target-motion-on-reveal')
      || root.getAttribute('data-scratch-replay-target-motion-on-reveal')
      || (scratchWidget?.props?.replayTargetMotionOnReveal === false ? 'false' : 'true')) !== 'false';
    const targetIds = scene && scratchWidget
      ? new Set(resolveScratchTargets(scene, scratchWidget).map((widget) => widget.id))
      : new Set<string>();
    const scratchSubtreeIds = scene && scratchWidget
      ? new Set(resolveScratchSubtreeWidgets(scene, scratchWidget).map((widget) => widget.id))
      : new Set<string>();
    const captureVisibilitySnapshot = (node: HTMLElement): void => {
      if (visibilitySnapshots.has(node)) return;
      visibilitySnapshots.set(node, {
        display: node.style.display,
        visibility: node.style.visibility,
        pointerEvents: node.style.pointerEvents,
      });
    };
    const hideRuntimeNode = (node: HTMLElement): void => {
      captureVisibilitySnapshot(node);
      node.style.display = 'none';
      node.style.visibility = 'hidden';
      node.style.pointerEvents = 'none';
    };

    if (scene && scratchWidget) {
      scratchSubtreeIds.forEach((widgetId) => {
        if (widgetId === scratchWidget.id) return;
        findRuntimeWidgetNodes(widgetId).forEach(hideRuntimeNode);
      });
      if (revealTargetMode !== 'scene') {
        resolveCoveredScratchWidgets(scene, scratchWidget).forEach((widget) => {
          if (targetIds.has(widget.id)) return;
          findRuntimeWidgetNodes(widget.id).forEach(hideRuntimeNode);
        });
      }
    }

    let scratchEngine: ScratchMaskEngine | null = null;

    const emitScratchMilestone = (milestone: ScratchMilestone, perfNow: number): void => {
      if (!scene) return;
      if (!scratchWidget) return;
      const targets = resolveScratchTargets(scene, scratchWidget);
      const trigger = milestone.emitTrigger as ScratchMilestoneTrigger;
      const clock = createEventClock(trigger, perfNow);
      const sceneTimeMs = perfNow - startedAt;
      targets.forEach((widget) => {
        engine.emit({
          trigger,
          sourceId: scratchWidgetId,
          targetId: widget.id,
          sceneTimeMs,
          realTimeMs: perfNow,
          clock,
        });
      });
    };

    const completeScratch = (): void => {
      if (scratchEngine?.isCompleted() === false) {
        // no-op: createScratchMaskEngine flips completion before calling onComplete
      }
      shell.classList.add('is-scratch-complete');
      const completionPerfMs = nowMs();
      runtimeWindow.__smxScratchCompletionMsByWidgetId![scratchWidgetId] = completionPerfMs - startedAt;
      runtimeWindow.__smxScratchCompletionPerfMsByWidgetId![scratchWidgetId] = completionPerfMs;
      if (maskTarget) {
        maskTarget.style.display = 'none';
        maskTarget.style.visibility = 'hidden';
        maskPath?.setAttribute('d', '');
      } else {
        const clearContext = canvas.getContext('2d');
        clearContext?.clearRect(0, 0, canvas.width, canvas.height);
      }
      canvas.style.display = 'none';

      if (!scene || !scratchWidget) return;
      const clock = createEventClock('reveal', completionPerfMs);
      const revealMetadata = buildScratchRevealMetadata(replayTargetMotionOnReveal);
      findRuntimeWidgetNodes(scratchWidget.id).forEach(hideRuntimeNode);
      if (revealTargetMode !== 'scene') {
        scratchSubtreeIds.forEach((widgetId) => {
          findRuntimeWidgetNodes(widgetId).forEach((node) => {
            if (targetIds.has(widgetId)) {
              const snapshot = visibilitySnapshots.get(node);
              if (!snapshot) return;
              node.style.display = snapshot.display;
              node.style.visibility = snapshot.visibility;
              node.style.pointerEvents = snapshot.pointerEvents;
              return;
            }
            hideRuntimeNode(node);
          });
        });
        resolveCoveredScratchWidgets(scene, scratchWidget).forEach((widget) => {
          findRuntimeWidgetNodes(widget.id).forEach((node) => {
            if (targetIds.has(widget.id)) {
              const snapshot = visibilitySnapshots.get(node);
              if (!snapshot) return;
              node.style.display = snapshot.display;
              node.style.visibility = snapshot.visibility;
              node.style.pointerEvents = snapshot.pointerEvents;
              return;
            }
            hideRuntimeNode(node);
          });
        });
      }
      resolveScratchTargets(scene, scratchWidget).forEach((widget) => {
        engine.emit({
          trigger: 'reveal',
          sourceId: scratchWidgetId,
          targetId: widget.id,
          sceneTimeMs: completionPerfMs - startedAt,
          realTimeMs: completionPerfMs,
          clock,
          metadata: revealMetadata,
        });
        engine.emit({
          trigger: 'scratch-complete',
          sourceId: scratchWidgetId,
          targetId: widget.id,
          sceneTimeMs: completionPerfMs - startedAt,
          realTimeMs: completionPerfMs,
          clock: createEventClock('scratch-complete', completionPerfMs),
        });
      });
      if (revealTargetMode === 'scene' && revealTargetId) {
        const targetSceneIndex = sceneManager.findSceneIndexById(revealTargetId);
        if (targetSceneIndex >= 0) {
          window.setTimeout(() => sceneManager.showScene(targetSceneIndex), 50);
        }
      }
    };

    scratchEngine = createScratchMaskEngine({
      shell,
      maskPath,
      radius: scratchRadius,
      autoRevealThresholdPercent: completeThreshold,
      milestones,
      onMilestone: emitScratchMilestone,
      onComplete: completeScratch,
    });
    scratchEngine.reset({ force: true });

    const handlePointerDown = (event: PointerEvent): void => {
      if (!scratchReady) return;
      scratchEngine?.handlePointerDown(event.clientX, event.clientY);
    };

    const handlePointerMove = (event: PointerEvent): void => {
      scratchEngine?.handlePointerMove(event.clientX, event.clientY);
    };

    const handlePointerUp = (): void => {
      scratchEngine?.handlePointerUp();
    };

    shell.addEventListener('pointerdown', handlePointerDown);
    shell.addEventListener('pointermove', handlePointerMove);
    canvas.addEventListener('pointerdown', handlePointerDown);
    canvas.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    removers.push(() => shell.removeEventListener('pointerdown', handlePointerDown));
    removers.push(() => shell.removeEventListener('pointermove', handlePointerMove));
    removers.push(() => canvas.removeEventListener('pointerdown', handlePointerDown));
    removers.push(() => canvas.removeEventListener('pointermove', handlePointerMove));
    removers.push(() => window.removeEventListener('pointerup', handlePointerUp));
    removers.push(() => {
      maskPath?.setAttribute('d', '');
      scratchEngine?.dispose();
      scratchEngine = null;
    });
  });

  return {
    dispose: () => {
      removers.forEach((remove) => remove());
      visibilitySnapshots.forEach((snapshot, node) => {
        node.style.display = snapshot.display;
        node.style.visibility = snapshot.visibility;
        node.style.pointerEvents = snapshot.pointerEvents;
      });
    },
  };
}
