import { createEventClock } from '../../motion/animation-engine/clock';
import type { AnimationEngine } from '../../motion/animation-engine/engine';
import { buildScratchRevealMetadata } from '../../motion/animation-engine/reveal-replay';
import {
  DEFAULT_SCRATCH_AUTO_REVEAL_THRESHOLD,
  type ScratchMilestone,
} from '../../widgets/group/group-scratch-constants';
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

function createScratchProgressCanvas(width: number, height: number): HTMLCanvasElement | null {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(16, Math.min(96, Math.round(width / 4)));
  canvas.height = Math.max(16, Math.min(96, Math.round(height / 4)));
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  return canvas;
}

function initializeScratchMask(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function paintScratchCover(
  canvas: HTMLCanvasElement,
  coverImage: string,
  coverBlur: number,
  accent: string,
  onReady?: () => void,
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);

  const fallback = (): void => {
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#d1d5db';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = `${accent}22`;
    ctx.fillRect(0, 0, width, height);
    onReady?.();
  };

  if (!coverImage) {
    fallback();
    return;
  }

  const renderImage = (image: HTMLImageElement): void => {
    ctx.clearRect(0, 0, width, height);
    const blur = Math.max(0, Number(coverBlur || 0));
    ctx.filter = blur > 0 ? `blur(${blur}px)` : 'none';
    ctx.drawImage(image, 0, 0, width, height);
    ctx.filter = 'none';
    onReady?.();
  };

  const loadImage = (): void => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => renderImage(image);
    image.onerror = fallback;
    image.src = coverImage;
  };

  loadImage();
}

function eraseScratchStroke(
  canvas: HTMLCanvasElement,
  from: { x: number; y: number } | null,
  to: { x: number; y: number },
  radius: number,
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = radius * 2;
  ctx.beginPath();
  if (from) {
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(to.x, to.y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function eraseScratchProgress(
  progressCanvas: HTMLCanvasElement,
  from: { x: number; y: number } | null,
  to: { x: number; y: number },
  radius: number,
  sourceWidth: number,
  sourceHeight: number,
): number {
  const ctx = progressCanvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return 0;
  const scaleX = progressCanvas.width / Math.max(1, sourceWidth);
  const scaleY = progressCanvas.height / Math.max(1, sourceHeight);
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(1, radius * Math.max(scaleX, scaleY) * 2);
  ctx.beginPath();
  if (from) {
    ctx.moveTo(from.x * scaleX, from.y * scaleY);
    ctx.lineTo(to.x * scaleX, to.y * scaleY);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.ellipse(
    to.x * scaleX,
    to.y * scaleY,
    Math.max(1, radius * scaleX),
    Math.max(1, radius * scaleY),
    0,
    0,
    Math.PI * 2,
  );
  ctx.fill();
  ctx.restore();
  const pixels = ctx.getImageData(0, 0, progressCanvas.width, progressCanvas.height).data;
  let cleared = 0;
  for (let index = 3; index < pixels.length; index += 4) {
    cleared += (255 - pixels[index]) / 255;
  }
  return (cleared / Math.max(1, progressCanvas.width * progressCanvas.height)) * 100;
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
    const maskTarget = root.querySelector<HTMLElement>('[data-scratch-mask-target]');
    const canvas = root.querySelector<HTMLCanvasElement>('[data-scratch-canvas]');
    if (!canvas) return;

    const width = Math.max(1, shell.clientWidth || shell.offsetWidth || canvas.width);
    const height = Math.max(1, shell.clientHeight || shell.offsetHeight || canvas.height);
    canvas.width = width;
    canvas.height = height;
    const scratchWidgetId = root.getAttribute('data-scratch-widget-id') || root.getAttribute('data-widget-id') || '';
    const maskCanvas = maskTarget ? document.createElement('canvas') : canvas;
    maskCanvas.width = width;
    maskCanvas.height = height;
    initializeScratchMask(maskCanvas);

    const progressCanvas = createScratchProgressCanvas(width, height);
    if (progressCanvas) {
      initializeScratchMask(progressCanvas);
    }

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
    const firedMilestoneIds = new Set<string>();
    const coverImage = shell.getAttribute('data-scratch-cover-image') || root.getAttribute('data-scratch-cover-image') || '';
    const coverBlur = Number(shell.getAttribute('data-scratch-cover-blur') || root.getAttribute('data-scratch-cover-blur') || 0);
    const accent = shell.getAttribute('data-scratch-accent') || root.getAttribute('data-scratch-accent') || '#ffffff';
    const activationDelayMs = Math.max(0, Number(shell.getAttribute('data-scratch-activation-delay') || root.getAttribute('data-scratch-activation-delay') || 0));
    const revealTargetMode = (shell.getAttribute('data-scratch-reveal-target-mode')
      || root.getAttribute('data-scratch-reveal-target-mode')
      || 'auto').trim().toLowerCase();
    const revealTargetId = (shell.getAttribute('data-scratch-reveal-target-id')
      || root.getAttribute('data-scratch-reveal-target-id')
      || '').trim();

    if (!maskTarget) {
      paintScratchCover(maskCanvas, coverImage, coverBlur, accent);
    }

    let activeMaskUrl = '';
    let maskSyncPending = false;
    let maskSyncQueued = false;
    let maskSyncFrame: number | null = null;

    const applyScratchMask = (nextUrl: string): void => {
      if (!maskTarget) return;
      maskTarget.style.webkitMaskImage = `url("${nextUrl}")`;
      maskTarget.style.maskImage = `url("${nextUrl}")`;
      maskTarget.style.webkitMaskSize = '100% 100%';
      maskTarget.style.maskSize = '100% 100%';
      maskTarget.style.webkitMaskRepeat = 'no-repeat';
      maskTarget.style.maskRepeat = 'no-repeat';
      maskTarget.style.webkitMaskPosition = 'center';
      maskTarget.style.maskPosition = 'center';
    };

    const clearScratchMask = (): void => {
      if (!maskTarget) return;
      maskTarget.style.webkitMaskImage = 'none';
      maskTarget.style.maskImage = 'none';
    };

    const canUseObjectUrls = (): boolean => typeof URL !== 'undefined'
      && typeof URL.createObjectURL === 'function'
      && typeof URL.revokeObjectURL === 'function';

    const revokeMaskUrl = (maskUrl: string): void => {
      if (!maskUrl || !canUseObjectUrls()) return;
      URL.revokeObjectURL(maskUrl);
    };

    const createMaskUrl = (blob: Blob): string => {
      if (!canUseObjectUrls()) return '';
      return URL.createObjectURL(blob);
    };

    const commitMaskUrl = (nextUrl: string): void => {
      revokeMaskUrl(activeMaskUrl && activeMaskUrl !== nextUrl ? activeMaskUrl : '');
      activeMaskUrl = nextUrl;
      if (nextUrl) {
        applyScratchMask(nextUrl);
      } else {
        clearScratchMask();
      }
    };

    const flushMaskPreview = (): void => {
      if (!maskTarget) return;
      if (maskSyncPending) {
        maskSyncQueued = true;
        return;
      }
      if (typeof maskCanvas.toBlob !== 'function') return;
      maskSyncQueued = false;
      maskSyncPending = true;
      maskCanvas.toBlob((blob) => {
        maskSyncPending = false;
        if (blob) {
          commitMaskUrl(createMaskUrl(blob));
        }
        if (maskSyncQueued) {
          maskSyncQueued = false;
          maskSyncFrame = window.requestAnimationFrame(() => {
            maskSyncFrame = null;
            flushMaskPreview();
          });
        }
      }, 'image/png');
    };

    const scheduleMaskPreview = (): void => {
      if (!maskTarget) return;
      if (maskSyncFrame !== null) {
        maskSyncQueued = true;
        return;
      }
      maskSyncFrame = window.requestAnimationFrame(() => {
        maskSyncFrame = null;
        flushMaskPreview();
      });
    };

    if (maskTarget) {
      scheduleMaskPreview();
    }

    let completed = false;
    let pointerActive = false;
    let lastScratchPoint: { x: number; y: number } | null = null;
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
      if (completed) return;
      completed = true;
      shell.classList.add('is-scratch-complete');
      const completionPerfMs = nowMs();
      runtimeWindow.__smxScratchCompletionMsByWidgetId![scratchWidgetId] = completionPerfMs - startedAt;
      runtimeWindow.__smxScratchCompletionPerfMsByWidgetId![scratchWidgetId] = completionPerfMs;
      if (maskTarget) {
        maskTarget.style.display = 'none';
        maskTarget.style.visibility = 'hidden';
        clearScratchMask();
        revokeMaskUrl(activeMaskUrl);
        activeMaskUrl = '';
      } else {
        const clearContext = maskCanvas.getContext('2d');
        clearContext?.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
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

    const scratchAt = (clientX: number, clientY: number): void => {
      if (!scratchReady || completed) return;
      const rect = shell.getBoundingClientRect();
      const point = { x: clientX - rect.left, y: clientY - rect.top };
      const previousPoint = lastScratchPoint;
      eraseScratchStroke(maskCanvas, previousPoint, point, scratchRadius);
      scheduleMaskPreview();
      lastScratchPoint = point;
      const progress = progressCanvas
        ? eraseScratchProgress(progressCanvas, previousPoint, point, scratchRadius, width, height)
        : 100;
      const perfNow = nowMs();
      for (const milestone of milestones) {
        if (firedMilestoneIds.has(milestone.id)) continue;
        if (progress < milestone.thresholdPercent) break;
        firedMilestoneIds.add(milestone.id);
        emitScratchMilestone(milestone, perfNow);
      }
      if (completeThreshold > 0 && progress >= completeThreshold) {
        completeScratch();
      }
    };

    const handlePointerDown = (event: PointerEvent): void => {
      if (!scratchReady) return;
      pointerActive = true;
      lastScratchPoint = null;
      scratchAt(event.clientX, event.clientY);
    };

    const handlePointerMove = (event: PointerEvent): void => {
      if (!pointerActive) return;
      scratchAt(event.clientX, event.clientY);
    };

    const handlePointerUp = (): void => {
      pointerActive = false;
      lastScratchPoint = null;
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
      if (maskSyncFrame !== null) {
        window.cancelAnimationFrame(maskSyncFrame);
      }
      if (activeMaskUrl) {
        revokeMaskUrl(activeMaskUrl);
        activeMaskUrl = '';
      }
      clearScratchMask();
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
