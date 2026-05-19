import { configureCanvas, getCtx, paintCover as paintCoverDescriptor } from './cover-paint';
import { ProgressTracker } from './progress';
import type {
  ScratchCoverDescriptor,
  ScratchEngineConfig,
  ScratchEngineHandle,
  ScratchMilestone,
  ScratchPoint,
} from './types';

const DEFAULTS = {
  threshold: 0.5,
  brushSize: 24,
  autoRemove: true,
  fadeOutMs: 200,
  activationDelayMs: 0,
} as const;

const MIN_BRUSH = 4;
const MAX_BRUSH = 128;

export function attachScratch(config: ScratchEngineConfig): ScratchEngineHandle {
  const root = config.root;
  if (!root) throw new Error('attachScratch: root is required');

  const coverEl = config.coverElement ?? root.querySelector<HTMLElement>('[data-scratch-cover]') ?? root;
  const revealEl = config.revealElement ?? root.querySelector<HTMLElement>('[data-scratch-reveal]') ?? null;
  const existingCanvas = config.canvas ?? root.querySelector<HTMLCanvasElement>('[data-scratch-canvas]');
  const existingHitArea = config.hitArea ?? root.querySelector<HTMLElement>('[data-scratch-hit-area]');

  const threshold = clamp01(numOr(config.threshold, DEFAULTS.threshold));
  const brushSize = Math.max(MIN_BRUSH, Math.min(MAX_BRUSH, numOr(config.brushSize, DEFAULTS.brushSize)));
  const autoRemove = boolOr(config.autoRemove, DEFAULTS.autoRemove);
  const fadeOutMs = Math.max(0, numOr(config.fadeOutMs, DEFAULTS.fadeOutMs));
  const activationDelayMs = Math.max(0, numOr(config.activationDelayMs, DEFAULTS.activationDelayMs));
  const milestones = (config.milestones ?? [])
    .filter((entry): entry is ScratchMilestone => Boolean(entry?.id) && Number.isFinite(entry?.at))
    .map((entry) => ({ id: entry.id, at: clamp01(entry.at) }))
    .sort((left, right) => left.at - right.at);
  const cover = config.cover ?? resolveCoverDescriptor(coverEl, root);

  const canvas = existingCanvas ?? document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.setAttribute('data-scratch-canvas', '');
  canvas.style.position = 'absolute';
  canvas.style.inset = '0';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.pointerEvents = 'none';
  canvas.style.display = '';
  canvas.style.opacity = '1';
  canvas.style.transition = fadeOutMs > 0 ? `opacity ${fadeOutMs}ms linear` : '';
  canvas.style.setProperty('-webkit-tap-highlight-color', 'transparent');

  const hitArea = existingHitArea ?? document.createElement('div');
  hitArea.setAttribute('data-scratch-hit-area', '');
  hitArea.dataset.scratchCompleted = 'false';
  hitArea.style.position = 'absolute';
  hitArea.style.inset = '0';
  hitArea.style.cursor = 'crosshair';
  hitArea.style.touchAction = 'none';
  hitArea.style.outline = 'none';
  hitArea.style.background = 'transparent';
  hitArea.style.setProperty('-webkit-tap-highlight-color', 'transparent');
  hitArea.style.userSelect = 'none';
  hitArea.style.pointerEvents = 'auto';

  let createdCanvas = false;
  if (!existingCanvas) {
    coverEl.appendChild(canvas);
    createdCanvas = true;
  }

  let createdHitArea = false;
  if (!existingHitArea) {
    root.appendChild(hitArea);
    createdHitArea = true;
  }

  if (!root.style.position) root.style.position = 'relative';
  if (coverEl !== root && !coverEl.style.position) coverEl.style.position = 'absolute';
  if (coverEl !== root && !coverEl.style.inset) coverEl.style.inset = '0';
  if (revealEl && !revealEl.style.position) revealEl.style.position = 'absolute';
  if (revealEl && !revealEl.style.inset) revealEl.style.inset = '0';

  let width = 1;
  let height = 1;
  let dpr = 1;
  let active = activationDelayMs <= 0;
  let completed = false;
  let scratched = false;
  let pointerDown = false;
  let lastPoint: ScratchPoint | null = null;
  let progress: ProgressTracker | null = null;
  let activationTimer = 0;
  let observer: ResizeObserver | null = null;
  let fadeOutTimer = 0;
  let firedMilestones = new Set<string>();

  const paint = async (): Promise<void> => {
    const nextWidth = Math.max(1, Math.round(root.clientWidth || canvas.clientWidth || width || 1));
    const nextHeight = Math.max(1, Math.round(root.clientHeight || canvas.clientHeight || height || 1));
    width = nextWidth;
    height = nextHeight;
    dpr = configureCanvas(canvas, width, height);
    progress?.destroy();
    progress = new ProgressTracker(width, height);
    const ctx = getCtx(canvas);
    if (!ctx) return;
    if (typeof ctx.setTransform === 'function') {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    ctx.clearRect(0, 0, width, height);
    let painted = false;
    if (config.paintCover) {
      const result = await config.paintCover({ canvas, ctx, width, height, cover });
      painted = result === true;
    }
    if (!painted && cover) {
      await paintCoverDescriptor(canvas, cover, width, height);
    }
  };

  const setReady = (ready: boolean) => {
    root.setAttribute('data-scratch-ready', ready ? 'true' : 'false');
    hitArea.style.pointerEvents = ready && !completed ? 'auto' : 'none';
  };

  const complete = (cleared: number): void => {
    if (completed) return;
    completed = true;
    pointerDown = false;
    lastPoint = null;
    root.classList.add('is-scratch-complete');
    root.setAttribute('data-scratch-completed', 'true');
    hitArea.dataset.scratchCompleted = 'true';
    hitArea.style.pointerEvents = 'none';
    canvas.style.opacity = '0';
    if (autoRemove) {
      if (fadeOutMs <= 0) {
        canvas.style.display = 'none';
      } else {
        fadeOutTimer = window.setTimeout(() => {
          canvas.style.display = 'none';
        }, fadeOutMs);
      }
    }
    config.onReveal?.(cleared);
  };

  const emitProgress = (cleared: number): void => {
    config.onProgress?.({
      cleared,
      thresholdReached: threshold > 0 && cleared >= threshold,
    });
    for (const milestone of milestones) {
      if (firedMilestones.has(milestone.id)) continue;
      if (cleared < milestone.at) break;
      firedMilestones.add(milestone.id);
      config.onMilestone?.(milestone.id, cleared);
    }
    if (threshold > 0 && cleared >= threshold) {
      complete(cleared);
    }
  };

  const toLocalPoint = (clientX: number, clientY: number): ScratchPoint => {
    const rect = hitArea.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(width, ((clientX - rect.left) / Math.max(1, rect.width || width)) * width)),
      y: Math.max(0, Math.min(height, ((clientY - rect.top) / Math.max(1, rect.height || height)) * height)),
    };
  };

  const scratchAt = (clientX: number, clientY: number): void => {
    if (completed) return;
    const point = toLocalPoint(clientX, clientY);
    const ctx = getCtx(canvas);
    if (!ctx) return;
    if (typeof ctx.setTransform === 'function') {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    drawDestinationOutStroke(ctx, point, lastPoint, brushSize);
    progress?.erase(lastPoint, point, brushSize);
    scratched = true;
    lastPoint = point;
    emitProgress(progress?.readCleared() ?? 0);
  };

  const onPointerDown = (event: PointerEvent): void => {
    if (!active || completed || event.isPrimary === false) return;
    if (event.cancelable) event.preventDefault();
    pointerDown = true;
    lastPoint = null;
    hitArea.setPointerCapture?.(event.pointerId);
    scratchAt(event.clientX, event.clientY);
  };

  const onPointerMove = (event: PointerEvent): void => {
    if (!pointerDown || completed) return;
    if (event.cancelable) event.preventDefault();
    scratchAt(event.clientX, event.clientY);
  };

  const onPointerUp = (event?: PointerEvent): void => {
    pointerDown = false;
    lastPoint = null;
    if (event) hitArea.releasePointerCapture?.(event.pointerId);
  };

  hitArea.addEventListener('pointerdown', onPointerDown);
  hitArea.addEventListener('pointermove', onPointerMove);
  hitArea.addEventListener('pointerup', onPointerUp);
  hitArea.addEventListener('pointercancel', onPointerUp);
  hitArea.addEventListener('lostpointercapture', onPointerUp);

  if (active) {
    setReady(true);
  } else {
    setReady(false);
    activationTimer = window.setTimeout(() => {
      active = true;
      setReady(true);
    }, activationDelayMs);
  }

  root.setAttribute('data-scratch-completed', 'false');
  void paint();

  if (typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(() => {
      if (completed || scratched) return;
      void paint();
    });
    observer.observe(root);
  }

  return {
    destroy() {
      if (activationTimer) window.clearTimeout(activationTimer);
      if (fadeOutTimer) window.clearTimeout(fadeOutTimer);
      observer?.disconnect();
      hitArea.removeEventListener('pointerdown', onPointerDown);
      hitArea.removeEventListener('pointermove', onPointerMove);
      hitArea.removeEventListener('pointerup', onPointerUp);
      hitArea.removeEventListener('pointercancel', onPointerUp);
      hitArea.removeEventListener('lostpointercapture', onPointerUp);
      progress?.destroy();
      progress = null;
      if (createdHitArea) hitArea.remove();
      if (createdCanvas) canvas.remove();
    },
    reset() {
      if (fadeOutTimer) window.clearTimeout(fadeOutTimer);
      completed = false;
      scratched = false;
      pointerDown = false;
      lastPoint = null;
      firedMilestones = new Set<string>();
      root.classList.remove('is-scratch-complete');
      root.setAttribute('data-scratch-completed', 'false');
      hitArea.dataset.scratchCompleted = 'false';
      canvas.style.display = '';
      canvas.style.opacity = '1';
      setReady(active);
      void paint();
    },
    revealNow() {
      complete(1);
    },
    getCleared() {
      return progress?.readCleared() ?? 0;
    },
    isActive() {
      return active && !completed;
    },
  };
}

function resolveCoverDescriptor(
  coverEl: HTMLElement,
  root: HTMLElement,
): ScratchCoverDescriptor {
  const image = coverEl.getAttribute('data-scratch-cover-image')
    || root.getAttribute('data-scratch-cover-image')
    || '';
  if (image) {
    return {
      kind: 'image',
      src: image,
      fit: (coverEl.getAttribute('data-scratch-cover-fit')
        || root.getAttribute('data-scratch-cover-fit')
        || 'cover') as 'cover' | 'contain' | 'fill',
    };
  }
  const color = coverEl.getAttribute('data-scratch-cover-color')
    || root.getAttribute('data-scratch-cover-color')
    || '#cccccc';
  return { kind: 'color', value: color };
}

function drawDestinationOutStroke(
  ctx: CanvasRenderingContext2D,
  point: ScratchPoint,
  previousPoint: ScratchPoint | null,
  radius: number,
): void {
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = radius * 2;
  if (previousPoint) {
    ctx.beginPath();
    ctx.moveTo(previousPoint.x, previousPoint.y);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function numOr(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) ? Number(value) : fallback;
}

function boolOr(value: boolean | undefined, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
