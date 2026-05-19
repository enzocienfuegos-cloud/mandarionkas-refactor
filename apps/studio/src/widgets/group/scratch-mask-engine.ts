import type { ScratchMilestone } from './group-scratch-constants';

type ScratchPoint = { x: number; y: number };

export type ScratchMaskEngineConfig = {
  shell: HTMLElement;
  maskPath: SVGPathElement | null;
  radius: number;
  autoRevealThresholdPercent: number;
  milestones: readonly ScratchMilestone[];
  onMilestone: (milestone: ScratchMilestone, clearedPercent: number, perfNow: number) => void;
  onComplete: (clearedPercent: number, perfNow: number) => void;
};

export type ScratchMaskEngine = {
  size: { readonly width: number; readonly height: number };
  isCompleted: () => boolean;
  handlePointerDown: (clientX: number, clientY: number) => void;
  handlePointerMove: (clientX: number, clientY: number) => void;
  handlePointerUp: () => void;
  reset: (options?: { force?: boolean }) => void;
  dispose: () => void;
};

function nowMs(): number {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}

export function createScratchProgressCanvas(width: number, height: number): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(16, Math.min(96, Math.round(width / 4)));
  canvas.height = Math.max(16, Math.min(96, Math.round(height / 4)));
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  return canvas;
}

export function initializeScratchProgressCanvas(canvas: HTMLCanvasElement | null): void {
  if (!canvas) return;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

export function initializeScratchPathElement(
  pathElement: SVGPathElement | null,
  radius: number,
): void {
  if (!pathElement) return;
  pathElement.setAttribute('d', '');
  pathElement.setAttribute('stroke', 'black');
  pathElement.setAttribute('stroke-width', String(radius * 2));
  pathElement.setAttribute('stroke-linecap', 'round');
  pathElement.setAttribute('stroke-linejoin', 'round');
  pathElement.setAttribute('fill', 'none');
}

export function appendScratchPathSegment(
  pathElement: SVGPathElement | null,
  from: ScratchPoint | null,
  to: ScratchPoint,
  existingPath: string,
): string {
  const segment = from
    ? `M ${from.x} ${from.y} L ${to.x} ${to.y}`
    : `M ${to.x} ${to.y} L ${to.x} ${to.y}`;
  const nextPath = existingPath ? `${existingPath} ${segment}` : segment;
  pathElement?.setAttribute('d', nextPath);
  return nextPath;
}

export function eraseScratchProgress(
  progressCanvas: HTMLCanvasElement,
  from: ScratchPoint | null,
  to: ScratchPoint,
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

export function createScratchMaskEngine(config: ScratchMaskEngineConfig): ScratchMaskEngine {
  const sizeRef = { width: 1, height: 1 };
  let progressCanvas: HTMLCanvasElement | null = null;
  let pathData = '';
  let pointerActive = false;
  let lastPoint: ScratchPoint | null = null;
  let completed = false;
  let firedMilestoneIds = new Set<string>();

  const sortedMilestones = [...config.milestones].sort(
    (left, right) => left.thresholdPercent - right.thresholdPercent,
  );

  const resolveSize = (): void => {
    const width = Math.max(1, Math.round(config.shell.clientWidth ?? 1));
    const height = Math.max(1, Math.round(config.shell.clientHeight ?? 1));
    sizeRef.width = width;
    sizeRef.height = height;
  };

  const rebuildProgressCanvas = (): void => {
    progressCanvas = createScratchProgressCanvas(sizeRef.width, sizeRef.height);
    initializeScratchProgressCanvas(progressCanvas);
  };

  const scratchAt = (clientX: number, clientY: number): void => {
    if (completed) return;
    const rect = config.shell.getBoundingClientRect();
    const x = ((clientX - rect.left) / Math.max(1, rect.width)) * sizeRef.width;
    const y = ((clientY - rect.top) / Math.max(1, rect.height)) * sizeRef.height;
    const point = { x, y };
    pathData = appendScratchPathSegment(config.maskPath, lastPoint, point, pathData);

    const clearedPercent = progressCanvas
      ? eraseScratchProgress(progressCanvas, lastPoint, point, config.radius, sizeRef.width, sizeRef.height)
      : 100;

    lastPoint = point;
    const perfNow = nowMs();

    for (const milestone of sortedMilestones) {
      if (firedMilestoneIds.has(milestone.id)) continue;
      if (clearedPercent < milestone.thresholdPercent) break;
      firedMilestoneIds.add(milestone.id);
      config.onMilestone(milestone, clearedPercent, perfNow);
    }

    if (config.autoRevealThresholdPercent > 0 && clearedPercent >= config.autoRevealThresholdPercent) {
      completed = true;
      pointerActive = false;
      lastPoint = null;
      config.onComplete(clearedPercent, perfNow);
    }
  };

  resolveSize();
  initializeScratchPathElement(config.maskPath, config.radius);
  rebuildProgressCanvas();

  return {
    size: sizeRef,
    isCompleted: () => completed,
    handlePointerDown(clientX, clientY) {
      if (completed) return;
      pointerActive = true;
      lastPoint = null;
      scratchAt(clientX, clientY);
    },
    handlePointerMove(clientX, clientY) {
      if (!pointerActive || completed) return;
      scratchAt(clientX, clientY);
    },
    handlePointerUp() {
      pointerActive = false;
      lastPoint = null;
    },
    reset({ force = false } = {}) {
      if (!force && (pointerActive || completed)) return;
      resolveSize();
      initializeScratchPathElement(config.maskPath, config.radius);
      pathData = '';
      rebuildProgressCanvas();
      lastPoint = null;
      completed = false;
      firedMilestoneIds = new Set<string>();
    },
    dispose() {
      pointerActive = false;
      lastPoint = null;
      progressCanvas = null;
    },
  };
}
