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

type ScratchPoint = { x: number; y: number };

type ScratchCanvasState = {
  width: number;
  height: number;
  dpr: number;
  progressCanvas: HTMLCanvasElement | null;
  pointerActive: boolean;
  lastPoint: ScratchPoint | null;
  completed: boolean;
  hasScratched: boolean;
  firedMilestoneIds: Set<string>;
};

const MAX_SCRATCH_DPR = 2;
const MAX_PROGRESS_CANVAS_SIZE = 96;

function nowMs(): number {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}

function get2dContext(canvas: HTMLCanvasElement, willReadFrequently = false): CanvasRenderingContext2D | null {
  return willReadFrequently
    ? canvas.getContext('2d', { willReadFrequently: true })
    : canvas.getContext('2d');
}

function isTransparentPaint(value: unknown): boolean {
  const normalized = String(value ?? '').trim().toLowerCase();
  return !normalized
    || normalized === 'transparent'
    || normalized === 'none'
    || normalized === 'rgba(0,0,0,0)'
    || normalized === 'rgba(0, 0, 0, 0)';
}

function isPlainWhite(value: unknown): boolean {
  const normalized = String(value ?? '').trim().toLowerCase();
  return normalized === '#fff'
    || normalized === '#ffffff'
    || normalized === 'white'
    || normalized === 'rgb(255,255,255)'
    || normalized === 'rgb(255, 255, 255)'
    || normalized === 'rgba(255,255,255,1)'
    || normalized === 'rgba(255, 255, 255, 1)';
}

function resolveScratchCoverColor(shell: HTMLElement, root: HTMLElement): string {
  const explicit = shell.getAttribute('data-scratch-cover-color') || root.getAttribute('data-scratch-cover-color') || '';
  if (!isTransparentPaint(explicit)) return explicit;

  const accent = shell.getAttribute('data-scratch-accent') || root.getAttribute('data-scratch-accent') || '';
  if (!isTransparentPaint(accent) && !isPlainWhite(accent)) return accent;

  return 'rgba(245, 158, 11, 0.94)';
}

function createScratchProgressCanvas(width: number, height: number): HTMLCanvasElement | null {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(16, Math.min(MAX_PROGRESS_CANVAS_SIZE, Math.round(width / 4)));
  canvas.height = Math.max(16, Math.min(MAX_PROGRESS_CANVAS_SIZE, Math.round(height / 4)));
  const ctx = get2dContext(canvas, true);
  if (!ctx) return null;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  return canvas;
}

function safeSetFillStyle(ctx: CanvasRenderingContext2D, value: string): boolean {
  try {
    ctx.fillStyle = value;
    return true;
  } catch {
    return false;
  }
}

function drawRoundedRect(ctx: CanvasRenderingContext2D, width: number, height: number, radius: number): void {
  const safeRadius = Math.max(0, Math.min(radius, width / 2, height / 2));
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(0, 0, width, height, safeRadius);
    return;
  }
  ctx.moveTo(safeRadius, 0);
  ctx.lineTo(width - safeRadius, 0);
  ctx.quadraticCurveTo(width, 0, width, safeRadius);
  ctx.lineTo(width, height - safeRadius);
  ctx.quadraticCurveTo(width, height, width - safeRadius, height);
  ctx.lineTo(safeRadius, height);
  ctx.quadraticCurveTo(0, height, 0, height - safeRadius);
  ctx.lineTo(0, safeRadius);
  ctx.quadraticCurveTo(0, 0, safeRadius, 0);
  ctx.closePath();
}

function resolveRuntimeBackground(widget: ExportRuntimeWidget): string {
  return String(
    widget.style?.background
      ?? widget.style?.backgroundColor
      ?? widget.props?.backgroundColor
      ?? 'transparent',
  ).trim();
}

function resolveRuntimeTextColor(widget: ExportRuntimeWidget): string {
  return String(widget.style?.color ?? widget.props?.color ?? '#ffffff').trim() || '#ffffff';
}

function drawRuntimeBackground(ctx: CanvasRenderingContext2D, widget: ExportRuntimeWidget): boolean {
  const background = resolveRuntimeBackground(widget);
  if (isTransparentPaint(background)) return false;
  if (!safeSetFillStyle(ctx, background)) return false;
  drawRoundedRect(ctx, Number(widget.frame.width ?? 0), Number(widget.frame.height ?? 0), Number(widget.style?.borderRadius ?? 0));
  ctx.fill();
  return true;
}

function readRuntimeText(widget: ExportRuntimeWidget): string {
  const props = widget.props ?? {};
  if (typeof props.text === 'string') return props.text;
  if (typeof props.label === 'string') return props.label;
  if (typeof props.title === 'string') return props.title;
  if (typeof props.badge === 'string') return props.badge;
  return widget.id;
}

function drawRuntimeText(ctx: CanvasRenderingContext2D, widget: ExportRuntimeWidget): boolean {
  const text = readRuntimeText(widget).trim();
  if (!text) return false;
  const width = Number(widget.frame.width ?? 0);
  const height = Number(widget.frame.height ?? 0);
  if (width <= 0 || height <= 0) return false;

  const fontSize = Math.max(6, Number(widget.style?.fontSize ?? (widget.type === 'cta' ? 16 : 20)));
  const fontWeight = String(widget.style?.fontWeight ?? (widget.type === 'cta' ? 800 : 700));
  const fontFamily = String(widget.style?.fontFamily ?? 'Inter, Arial, sans-serif');
  const lineHeight = Math.max(fontSize * 1.05, Number(widget.style?.lineHeight ?? fontSize * 1.18));
  const padding = Math.max(6, Math.min(18, Number(widget.style?.padding ?? 10)));
  const maxWidth = Math.max(1, width - padding * 2);
  const maxHeight = Math.max(1, height - padding * 2);

  ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  if (!safeSetFillStyle(ctx, resolveRuntimeTextColor(widget))) return false;
  ctx.textAlign = String(widget.style?.textAlign ?? widget.style?.horizontalAlign ?? 'center') as CanvasTextAlign;
  ctx.textBaseline = 'middle';

  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';
  words.forEach((word) => {
    const nextLine = currentLine ? `${currentLine} ${word}` : word;
    const measuredWidth = typeof ctx.measureText === 'function'
      ? ctx.measureText(nextLine).width
      : nextLine.length * fontSize * 0.55;
    if (measuredWidth > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
      return;
    }
    currentLine = nextLine;
  });
  if (currentLine) lines.push(currentLine);

  const maxLines = Math.max(1, Math.floor(maxHeight / lineHeight));
  const visibleLines = lines.slice(0, maxLines);
  const totalHeight = (visibleLines.length - 1) * lineHeight;
  const x = ctx.textAlign === 'left'
    ? padding
    : ctx.textAlign === 'right'
      ? width - padding
      : width / 2;
  const yStart = height / 2 - totalHeight / 2;
  visibleLines.forEach((line, index) => {
    ctx.fillText?.(line, x, yStart + index * lineHeight, maxWidth);
  });
  return true;
}

function resolveRuntimeImageSource(widget: ExportRuntimeWidget): string {
  const domImage = findRuntimeWidgetNodes(widget.id)
    .map((node) => (node instanceof HTMLImageElement ? node : node.querySelector('img')))
    .find((node): node is HTMLImageElement => Boolean(node?.currentSrc || node?.src));
  if (domImage) return domImage.currentSrc || domImage.src;

  const props = widget.props ?? {};
  return String(
    props.src
      ?? props.imageSrc
      ?? props.baseImageSrc
      ?? props.image
      ?? props.url
      ?? '',
  ).trim();
}

function drawImageWithFit(
  ctx: CanvasRenderingContext2D,
  image: CanvasImageSource & { naturalWidth?: number; naturalHeight?: number; videoWidth?: number; videoHeight?: number },
  width: number,
  height: number,
  fit: string,
): void {
  const sourceWidth = Number(image.naturalWidth ?? image.videoWidth ?? width) || width;
  const sourceHeight = Number(image.naturalHeight ?? image.videoHeight ?? height) || height;
  if (fit === 'contain') {
    const scale = Math.min(width / Math.max(1, sourceWidth), height / Math.max(1, sourceHeight));
    const drawWidth = sourceWidth * scale;
    const drawHeight = sourceHeight * scale;
    ctx.drawImage(image, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
    return;
  }
  if (fit === 'fill' || fit === 'stretch') {
    ctx.drawImage(image, 0, 0, width, height);
    return;
  }
  const scale = Math.max(width / Math.max(1, sourceWidth), height / Math.max(1, sourceHeight));
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  ctx.drawImage(image, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
}

function drawRuntimeImage(
  ctx: CanvasRenderingContext2D,
  widget: ExportRuntimeWidget,
  coverBlur: number,
  shouldPaint: () => boolean,
): boolean {
  const src = resolveRuntimeImageSource(widget);
  const width = Number(widget.frame.width ?? 0);
  const height = Number(widget.frame.height ?? 0);
  if (!src || width <= 0 || height <= 0) return false;
  const fit = String(widget.props?.objectFit ?? widget.props?.fit ?? widget.style?.objectFit ?? 'cover').trim().toLowerCase();
  const transform = typeof ctx.getTransform === 'function' ? ctx.getTransform() : null;

  const renderImage = (image: HTMLImageElement) => {
    if (!shouldPaint()) return;
    ctx.save();
    if (transform && typeof ctx.setTransform === 'function') {
      ctx.setTransform(transform);
    }
    ctx.filter = coverBlur > 0 ? `blur(${Math.max(0, coverBlur)}px)` : 'none';
    drawImageWithFit(ctx, image, width, height, fit);
    ctx.filter = 'none';
    ctx.restore();
  };

  const existingImage = findRuntimeWidgetNodes(widget.id)
    .map((node) => (node instanceof HTMLImageElement ? node : node.querySelector('img')))
    .find((node): node is HTMLImageElement => Boolean(node?.complete && node.naturalWidth > 0));
  if (existingImage) {
    renderImage(existingImage);
    return true;
  }

  const loadImage = (useCrossOrigin: boolean) => {
    const image = new Image();
    if (useCrossOrigin) image.crossOrigin = 'anonymous';
    image.onload = () => renderImage(image);
    image.onerror = () => {
      if (useCrossOrigin) loadImage(false);
    };
    image.src = src;
  };
  loadImage(true);
  return true;
}

function getRuntimeChildren(scene: ExportRuntimeScene, widget: ExportRuntimeWidget): ExportRuntimeWidget[] {
  const widgetsById = Object.fromEntries(scene.widgets.map((entry) => [entry.id, entry] as const));
  const children = (widget.childIds ?? [])
    .map((childId) => widgetsById[childId])
    .filter((child): child is ExportRuntimeWidget => Boolean(child));
  if (children.length) return children.sort((left, right) => Number(left.zIndex ?? 0) - Number(right.zIndex ?? 0));
  return scene.widgets
    .filter((candidate) => candidate.parentId === widget.id)
    .sort((left, right) => Number(left.zIndex ?? 0) - Number(right.zIndex ?? 0));
}

function paintRuntimeScratchCoverWidget({
  ctx,
  scene,
  widget,
  rootFrame,
  excludedTargetIds,
  coverBlur,
  shouldPaint,
  visited,
}: {
  ctx: CanvasRenderingContext2D;
  scene: ExportRuntimeScene;
  widget: ExportRuntimeWidget;
  rootFrame: ExportRuntimeWidget['frame'];
  excludedTargetIds: ReadonlySet<string>;
  coverBlur: number;
  shouldPaint: () => boolean;
  visited: Set<string>;
}): boolean {
  if (visited.has(widget.id) || widget.hidden || excludedTargetIds.has(widget.id)) return false;
  visited.add(widget.id);

  const width = Number(widget.frame.width ?? 0);
  const height = Number(widget.frame.height ?? 0);
  if (width <= 0 || height <= 0) return false;

  let painted = false;
  ctx.save();
  const opacity = Math.max(0, Math.min(1, Number(widget.style?.opacity ?? 1)));
  ctx.globalAlpha = Number.isFinite(Number(ctx.globalAlpha))
    ? Number(ctx.globalAlpha) * opacity
    : opacity;
  ctx.translate?.(
    Number(widget.frame.x ?? 0) - Number(rootFrame.x ?? 0) + width / 2,
    Number(widget.frame.y ?? 0) - Number(rootFrame.y ?? 0) + height / 2,
  );
  ctx.rotate?.((Number(widget.frame.rotation ?? 0) * Math.PI) / 180);
  ctx.translate?.(-width / 2, -height / 2);

  if (widget.type === 'group') {
    painted = drawRuntimeBackground(ctx, widget) || painted;
  } else if (widget.type === 'image' || widget.type === 'hero-image') {
    painted = drawRuntimeImage(ctx, widget, coverBlur, shouldPaint) || painted;
  } else if (widget.type === 'cta') {
    painted = drawRuntimeBackground(ctx, widget) || painted;
    painted = drawRuntimeText(ctx, widget) || painted;
  } else if (widget.type === 'text' || widget.type === 'badge') {
    painted = drawRuntimeBackground(ctx, widget) || painted;
    painted = drawRuntimeText(ctx, widget) || painted;
  } else if (widget.type === 'shape') {
    painted = drawRuntimeBackground(ctx, widget) || painted;
  } else {
    painted = drawRuntimeBackground(ctx, widget) || painted;
  }

  ctx.restore();

  if (widget.type === 'group') {
    let childPainted = false;
    getRuntimeChildren(scene, widget).forEach((child) => {
      childPainted = paintRuntimeScratchCoverWidget({
        ctx,
        scene,
        widget: child,
        rootFrame,
        excludedTargetIds,
        coverBlur,
        shouldPaint,
        visited,
      }) || childPainted;
    });
    painted = childPainted || painted;
  }

  return painted;
}

function paintRuntimeScratchGroupedCoverSnapshot({
  ctx,
  scene,
  scratchWidget,
  excludedTargetIds,
  coverBlur,
  shouldPaint,
}: {
  ctx: CanvasRenderingContext2D;
  scene: ExportRuntimeScene;
  scratchWidget: ExportRuntimeWidget;
  excludedTargetIds: ReadonlySet<string>;
  coverBlur: number;
  shouldPaint: () => boolean;
}): boolean {
  const visited = new Set<string>();
  let painted = false;
  getRuntimeChildren(scene, scratchWidget).forEach((child) => {
    painted = paintRuntimeScratchCoverWidget({
      ctx,
      scene,
      widget: child,
      rootFrame: scratchWidget.frame,
      excludedTargetIds,
      coverBlur,
      shouldPaint,
      visited,
    }) || painted;
  });
  return painted;
}

function configureCanvasSize(canvas: HTMLCanvasElement, width: number, height: number): number {
  const dpr = Math.max(1, Math.min(MAX_SCRATCH_DPR, Number(window.devicePixelRatio || 1)));
  const pixelWidth = Math.max(1, Math.round(width * dpr));
  const pixelHeight = Math.max(1, Math.round(height * dpr));
  if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
  if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
  return dpr;
}

function paintScratchCoverCanvas({
  canvas,
  width,
  height,
  coverImage,
  coverColor,
  coverBlur,
  paintCover,
  shouldPaint,
}: {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  coverImage: string;
  coverColor: string;
  coverBlur: number;
  paintCover?: (ctx: CanvasRenderingContext2D) => boolean;
  shouldPaint: () => boolean;
}): { width: number; height: number; dpr: number } | null {
  const dpr = configureCanvasSize(canvas, width, height);
  const ctx = get2dContext(canvas);
  if (!ctx) return null;

  const resetTransform = () => {
    if (typeof ctx.setTransform === 'function') {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  };

  const paintFallback = () => {
    resetTransform();
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = coverColor;
    ctx.fillRect(0, 0, width, height);
  };

  resetTransform();
  ctx.clearRect(0, 0, width, height);
  const paintedGroupedCover = paintCover?.(ctx) ?? false;
  if (!paintedGroupedCover) {
    paintFallback();
  }

  if (!paintedGroupedCover && coverImage) {
    const renderImage = (image: HTMLImageElement) => {
      if (!shouldPaint()) return;
      resetTransform();
      ctx.clearRect(0, 0, width, height);
      ctx.filter = coverBlur > 0 ? `blur(${Math.max(0, coverBlur)}px)` : 'none';
      ctx.drawImage(image, 0, 0, width, height);
      ctx.filter = 'none';
    };

    const loadImage = (useCrossOrigin: boolean) => {
      const image = new Image();
      if (useCrossOrigin) image.crossOrigin = 'anonymous';
      image.onload = () => renderImage(image);
      image.onerror = () => {
        if (useCrossOrigin) {
          loadImage(false);
          return;
        }
        if (shouldPaint()) paintFallback();
      };
      image.src = coverImage;
    };

    loadImage(true);
  }

  return { width, height, dpr };
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
  ctx.beginPath();
  if (previousPoint) {
    ctx.moveTo(previousPoint.x, previousPoint.y);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function readClearedPercent(progressCanvas: HTMLCanvasElement): number {
  const ctx = get2dContext(progressCanvas, true);
  if (!ctx) return 100;
  const imageData = ctx.getImageData(0, 0, progressCanvas.width, progressCanvas.height);
  const data = imageData.data;
  let alphaTotal = 0;
  let pixelCount = 0;
  for (let index = 3; index < data.length; index += 4) {
    alphaTotal += data[index];
    pixelCount += 1;
  }
  if (!pixelCount) return 100;
  return Math.max(0, Math.min(100, 100 - (alphaTotal / (255 * pixelCount)) * 100));
}

function eraseScratchProgress({
  progressCanvas,
  point,
  previousPoint,
  radius,
  width,
  height,
}: {
  progressCanvas: HTMLCanvasElement;
  point: ScratchPoint;
  previousPoint: ScratchPoint | null;
  radius: number;
  width: number;
  height: number;
}): number {
  const ctx = get2dContext(progressCanvas, true);
  if (!ctx) return 100;
  const scaleX = progressCanvas.width / Math.max(1, width);
  const scaleY = progressCanvas.height / Math.max(1, height);
  const scalePoint = (input: ScratchPoint): ScratchPoint => ({
    x: input.x * scaleX,
    y: input.y * scaleY,
  });
  drawDestinationOutStroke(
    ctx,
    scalePoint(point),
    previousPoint ? scalePoint(previousPoint) : null,
    radius * Math.max(scaleX, scaleY),
  );
  return readClearedPercent(progressCanvas);
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

function resolveScratchInternalTargetDisplayIds(
  scene: ExportRuntimeScene,
  scratchWidget: ExportRuntimeWidget,
  internalTargetIds: ReadonlySet<string>,
): Set<string> {
  const widgetsById = Object.fromEntries(scene.widgets.map((entry) => [entry.id, entry] as const));
  const displayIds = new Set(internalTargetIds);
  internalTargetIds.forEach((targetId) => {
    let currentParentId = widgetsById[targetId]?.parentId;
    const visited = new Set<string>();
    while (currentParentId && currentParentId !== scratchWidget.id && !visited.has(currentParentId)) {
      visited.add(currentParentId);
      displayIds.add(currentParentId);
      currentParentId = widgetsById[currentParentId]?.parentId;
    }
  });
  return displayIds;
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
    const canvas = root.querySelector<HTMLCanvasElement>('[data-scratch-canvas]');
    const hitArea = root.querySelector<HTMLElement>('[data-scratch-hit-area]');
    if (!canvas) return;

    const scratchWidgetId = root.getAttribute('data-scratch-widget-id')
      || shell.getAttribute('data-scratch-widget-id')
      || root.getAttribute('data-widget-id')
      || '';
    const scratchRadius = Math.max(4, Number(shell.getAttribute('data-scratch-radius') || root.getAttribute('data-scratch-radius') || 18));
    const thresholdValue = shell.getAttribute('data-scratch-auto-reveal-threshold')
      || shell.getAttribute('data-scratch-threshold')
      || root.getAttribute('data-scratch-auto-reveal-threshold')
      || root.getAttribute('data-scratch-threshold')
      || String(DEFAULT_SCRATCH_AUTO_REVEAL_THRESHOLD);
    const completeThreshold = Math.max(0, Math.min(100, Number(thresholdValue)));
    const coverBlur = Math.max(0, Number(shell.getAttribute('data-scratch-cover-blur') || root.getAttribute('data-scratch-cover-blur') || 0));
    const coverImage = shell.getAttribute('data-scratch-cover-image') || root.getAttribute('data-scratch-cover-image') || '';
    const coverColor = resolveScratchCoverColor(shell, root);
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

    const startedAt = nowMs();
    const scene = resolveScratchScene(runtimeModel, scratchWidgetId);
    const scratchWidget = scene?.widgets.find((widget) => widget.id === scratchWidgetId);
    const isGroupScratch = scratchWidget?.type === 'group' && Boolean(scratchWidget.props?.scratchEnabled);
    const replayTargetMotionOnReveal = (shell.getAttribute('data-scratch-replay-target-motion-on-reveal')
      || root.getAttribute('data-scratch-replay-target-motion-on-reveal')
      || (scratchWidget?.props?.replayTargetMotionOnReveal === false ? 'false' : 'true')) !== 'false';
    const targetIds = scene && scratchWidget
      ? new Set(resolveScratchTargets(scene, scratchWidget).map((widget) => widget.id))
      : new Set<string>();
    const scratchSubtreeIds = scene && scratchWidget
      ? new Set(resolveScratchSubtreeWidgets(scene, scratchWidget).map((widget) => widget.id))
      : new Set<string>();
    const internalTargetIds = scene && scratchWidget
      ? resolveScratchInternalTargetIds(scene, scratchWidget)
      : new Set<string>();
    const internalTargetDisplayIds = scene && scratchWidget
      ? resolveScratchInternalTargetDisplayIds(scene, scratchWidget, internalTargetIds)
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
    const restoreRuntimeNode = (node: HTMLElement): void => {
      const snapshot = visibilitySnapshots.get(node);
      if (snapshot) {
        node.style.display = snapshot.display;
        node.style.visibility = snapshot.visibility;
        node.style.pointerEvents = snapshot.pointerEvents;
        return;
      }
      node.style.display = '';
      node.style.visibility = '';
      node.style.pointerEvents = '';
    };

    if (isGroupScratch && scene && scratchWidget) {
      scratchSubtreeIds.forEach((widgetId) => {
        if (widgetId === scratchWidget.id) return;
        if (internalTargetDisplayIds.has(widgetId)) return;
        findRuntimeWidgetNodes(widgetId).forEach(hideRuntimeNode);
      });
      if (revealTargetMode !== 'scene') {
        resolveCoveredScratchWidgets(scene, scratchWidget).forEach((widget) => {
          if (targetIds.has(widget.id)) return;
          findRuntimeWidgetNodes(widget.id).forEach(hideRuntimeNode);
        });
      }
    }

    const state: ScratchCanvasState = {
      width: 1,
      height: 1,
      dpr: 1,
      progressCanvas: null,
      pointerActive: false,
      lastPoint: null,
      completed: false,
      hasScratched: false,
      firedMilestoneIds: new Set<string>(),
    };

    const resetScratchCanvas = ({ force = false } = {}) => {
      if (state.completed) return;
      if (state.hasScratched && !force) return;
      const width = Math.max(1, Math.round(shell.clientWidth || shell.offsetWidth || canvas.clientWidth || canvas.width || 1));
      const height = Math.max(1, Math.round(shell.clientHeight || shell.offsetHeight || canvas.clientHeight || canvas.height || 1));
      const dimensionsChanged = state.width !== width || state.height !== height;
      if (!force && !dimensionsChanged) return;

      const paintedSize = paintScratchCoverCanvas({
        canvas,
        width,
        height,
        coverImage,
        coverColor,
        coverBlur,
        paintCover: isGroupScratch && scene && scratchWidget
          ? (canvasCtx) => paintRuntimeScratchGroupedCoverSnapshot({
            ctx: canvasCtx,
            scene,
            scratchWidget,
            excludedTargetIds: internalTargetIds,
            coverBlur,
            shouldPaint: () => !state.completed && !state.hasScratched,
          })
          : undefined,
        shouldPaint: () => !state.completed && !state.hasScratched,
      });
      if (!paintedSize) return;
      state.width = paintedSize.width;
      state.height = paintedSize.height;
      state.dpr = paintedSize.dpr;
      state.progressCanvas = createScratchProgressCanvas(width, height);
      state.pointerActive = false;
      state.lastPoint = null;
      state.hasScratched = false;
      state.firedMilestoneIds = new Set<string>();
      canvas.style.display = '';
      if (hitArea) {
        hitArea.style.pointerEvents = '';
        hitArea.dataset.scratchCompleted = 'false';
      }
      shell.setAttribute('data-scratch-completed', 'false');
    };

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

    const completeScratch = (clearedPercent: number): void => {
      if (state.completed) return;
      state.completed = true;
      state.pointerActive = false;
      state.lastPoint = null;
      shell.classList.add('is-scratch-complete');
      shell.setAttribute('data-scratch-completed', 'true');
      if (hitArea) {
        hitArea.dataset.scratchCompleted = 'true';
        hitArea.style.pointerEvents = 'none';
      }
      const completionPerfMs = nowMs();
      runtimeWindow.__smxScratchCompletionMsByWidgetId![scratchWidgetId] = completionPerfMs - startedAt;
      runtimeWindow.__smxScratchCompletionPerfMsByWidgetId![scratchWidgetId] = completionPerfMs;
      canvas.style.display = 'none';

      if (!scene || !scratchWidget) return;
      const clock = createEventClock('reveal', completionPerfMs);
      const revealMetadata = buildScratchRevealMetadata(replayTargetMotionOnReveal);
      if (isGroupScratch) {
        findRuntimeWidgetNodes(scratchWidget.id).forEach(hideRuntimeNode);
        if (revealTargetMode !== 'scene') {
          scratchSubtreeIds.forEach((widgetId) => {
            findRuntimeWidgetNodes(widgetId).forEach((node) => {
              if (targetIds.has(widgetId) || internalTargetDisplayIds.has(widgetId)) {
                restoreRuntimeNode(node);
                return;
              }
              hideRuntimeNode(node);
            });
          });
          resolveCoveredScratchWidgets(scene, scratchWidget).forEach((widget) => {
            findRuntimeWidgetNodes(widget.id).forEach((node) => {
              if (targetIds.has(widget.id)) {
                restoreRuntimeNode(node);
                return;
              }
              hideRuntimeNode(node);
            });
          });
        }
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
          metadata: { clearedPercent },
        });
      });
      if (revealTargetMode === 'scene' && revealTargetId) {
        const targetSceneIndex = sceneManager.findSceneIndexById(revealTargetId);
        if (targetSceneIndex >= 0) {
          window.setTimeout(() => sceneManager.showScene(targetSceneIndex), 50);
        }
      }
    };

    const processScratchProgress = (clearedPercent: number): void => {
      const perfNow = nowMs();
      for (const milestone of milestones) {
        if (state.firedMilestoneIds.has(milestone.id)) continue;
        if (clearedPercent < milestone.thresholdPercent) break;
        state.firedMilestoneIds.add(milestone.id);
        emitScratchMilestone(milestone, perfNow);
      }

      if (completeThreshold > 0 && clearedPercent >= completeThreshold) {
        completeScratch(clearedPercent);
      }
    };

    const scratchAt = (clientX: number, clientY: number): void => {
      if (state.completed) return;
      const rect = shell.getBoundingClientRect();
      const width = state.width || Math.max(1, rect.width || canvas.width || 1);
      const height = state.height || Math.max(1, rect.height || canvas.height || 1);
      const point = {
        x: Math.max(0, Math.min(width, ((clientX - rect.left) / Math.max(1, rect.width || width)) * width)),
        y: Math.max(0, Math.min(height, ((clientY - rect.top) / Math.max(1, rect.height || height)) * height)),
      };

      const ctx = get2dContext(canvas);
      if (ctx) {
        if (typeof ctx.setTransform === 'function') {
          ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
        }
        drawDestinationOutStroke(ctx, point, state.lastPoint, scratchRadius);
      }
      const clearedPercent = state.progressCanvas
        ? eraseScratchProgress({
            progressCanvas: state.progressCanvas,
            point,
            previousPoint: state.lastPoint,
            radius: scratchRadius,
            width,
            height,
          })
        : 100;
      state.hasScratched = true;
      state.lastPoint = point;
      processScratchProgress(clearedPercent);
    };

    resetScratchCanvas({ force: true });

    const handlePointerDown = (event: PointerEvent): void => {
      if (!scratchReady || state.completed) return;
      if (event.cancelable) event.preventDefault();
      event.stopPropagation();
      state.pointerActive = true;
      state.lastPoint = null;
      (event.currentTarget as Element | null)?.setPointerCapture?.(event.pointerId);
      scratchAt(event.clientX, event.clientY);
    };

    const handlePointerMove = (event: PointerEvent): void => {
      if (!state.pointerActive || state.completed) return;
      if (event.cancelable) event.preventDefault();
      event.stopPropagation();
      scratchAt(event.clientX, event.clientY);
    };

    const handlePointerUp = (event?: PointerEvent): void => {
      state.pointerActive = false;
      state.lastPoint = null;
      if (event?.currentTarget instanceof Element) {
        event.currentTarget.releasePointerCapture?.(event.pointerId);
      }
    };

    shell.addEventListener('pointerdown', handlePointerDown);
    shell.addEventListener('pointermove', handlePointerMove);
    canvas.addEventListener('pointerdown', handlePointerDown);
    canvas.addEventListener('pointermove', handlePointerMove);
    hitArea?.addEventListener('pointerdown', handlePointerDown);
    hitArea?.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);

    removers.push(() => shell.removeEventListener('pointerdown', handlePointerDown));
    removers.push(() => shell.removeEventListener('pointermove', handlePointerMove));
    removers.push(() => canvas.removeEventListener('pointerdown', handlePointerDown));
    removers.push(() => canvas.removeEventListener('pointermove', handlePointerMove));
    if (hitArea) {
      removers.push(() => hitArea.removeEventListener('pointerdown', handlePointerDown));
      removers.push(() => hitArea.removeEventListener('pointermove', handlePointerMove));
    }
    removers.push(() => window.removeEventListener('pointerup', handlePointerUp));
    removers.push(() => window.removeEventListener('pointercancel', handlePointerUp));

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => {
        if (state.completed || state.hasScratched) return;
        resetScratchCanvas({ force: false });
      });
      observer.observe(shell);
      removers.push(() => observer.disconnect());
    }

    removers.push(() => {
      state.pointerActive = false;
      state.lastPoint = null;
      state.progressCanvas = null;
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
