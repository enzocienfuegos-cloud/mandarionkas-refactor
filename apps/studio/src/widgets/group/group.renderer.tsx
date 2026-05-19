import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { getLiveWidgetFrame, getLiveWidgetOpacity, isWidgetVisibleAt } from '../../domain/document/timeline';
import type { WidgetNode } from '../../domain/document/types';
import type { RenderContext } from '../../canvas/stage/render-context';
import { resolveWidgetBackground, resolveWidgetBorder, resolveWidgetColor, resolveWidgetOpacity } from '../../canvas/stage/render-helpers';
import { playbackEngine } from '../../hooks/use-playback-engine';
import { useLatestRef } from '../../shared/hooks';
import { readShadowFromStyle, shadowConfigToBoxShadow } from '../../shared/style/shadow';
import { isScratchGroupActive } from './group-scratch-activation';
import {
  DEFAULT_SCRATCH_AUTO_REVEAL_THRESHOLD,
  DEFAULT_SCRATCH_MILESTONES,
  type ScratchMilestone,
} from './group-scratch-constants';
import { resolveScratchInternalTargetIds } from './group-reveal-target';

const MAX_SCRATCH_DPR = 2;
const MAX_PROGRESS_CANVAS_SIZE = 96;

type ScratchPoint = { x: number; y: number };

const groupBaseStyle: CSSProperties = {
  width: '100%',
  height: '100%',
  borderRadius: 18,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 14,
  fontWeight: 700,
};

const scratchShellStyle: CSSProperties = {
  position: 'relative',
  width: '100%',
  height: '100%',
  overflow: 'hidden',
};

const scratchEditorOverlayStyle: CSSProperties = {
  position: 'relative',
  width: '100%',
  height: '100%',
  border: '1px dashed rgba(249, 115, 22, 0.8)',
  borderRadius: 18,
  background: 'transparent',
  pointerEvents: 'none',
};

function renderDefaultGroup(node: WidgetNode, ctx: RenderContext): JSX.Element {
  const boxShadow = shadowConfigToBoxShadow(readShadowFromStyle(node.style));
  if (node.childIds?.length) {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          borderRadius: Number(node.style.borderRadius ?? 18),
          background: resolveWidgetBackground(node, 'transparent', ctx),
          opacity: resolveWidgetOpacity(node, ctx),
          boxShadow,
        }}
      />
    );
  }
  return (
    <div
      style={{
        ...groupBaseStyle,
        border: `1px dashed ${resolveWidgetBorder(node, ctx)}`,
        background: resolveWidgetBackground(node, 'rgba(139,92,246,0.08)', ctx),
        color: resolveWidgetColor(node, ctx),
        opacity: resolveWidgetOpacity(node, ctx),
        boxShadow,
      }}
    >
      {String(node.props.title ?? node.name)}
    </div>
  );
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

function resolveScratchCoverColor(node: WidgetNode, ctx: RenderContext): string {
  const explicitCoverColor = String(node.props.scratchCoverColor ?? '').trim();
  if (!isTransparentPaint(explicitCoverColor)) return explicitCoverColor;

  const background = resolveWidgetBackground(node, 'transparent', ctx);
  if (!isTransparentPaint(background)) return background;

  const accent = String(node.style.accentColor ?? '').trim();
  if (!isTransparentPaint(accent) && !isPlainWhite(accent)) return accent;

  return 'rgba(245, 158, 11, 0.94)';
}

function createScratchProgressCanvas(width: number, height: number): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
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

function drawCoverBackground(ctx: CanvasRenderingContext2D, node: WidgetNode, renderCtx: RenderContext): boolean {
  const frame = node.frame;
  const background = resolveWidgetBackground(node, 'transparent', renderCtx);
  if (isTransparentPaint(background)) return false;
  ctx.fillStyle = background;
  drawRoundedRect(ctx, frame.width, frame.height, Number(node.style.borderRadius ?? 0));
  ctx.fill();
  return true;
}

function drawCoverText(
  ctx: CanvasRenderingContext2D,
  text: string,
  node: WidgetNode,
  renderCtx: RenderContext,
): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  const fontSize = Math.max(6, Number(node.style.fontSize ?? (node.type === 'cta' ? 16 : 20)));
  const fontWeight = String(node.style.fontWeight ?? (node.type === 'cta' ? 800 : 700));
  const fontFamily = String(node.style.fontFamily ?? 'Inter, Arial, sans-serif');
  const lineHeight = Math.max(fontSize * 1.05, Number(node.style.lineHeight ?? fontSize * 1.18));
  const padding = Math.max(6, Math.min(18, Number(node.style.padding ?? 10)));
  const maxWidth = Math.max(1, node.frame.width - padding * 2);
  const maxHeight = Math.max(1, node.frame.height - padding * 2);
  ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  ctx.fillStyle = resolveWidgetColor(node, renderCtx);
  ctx.textAlign = String(node.style.textAlign ?? 'center') as CanvasTextAlign;
  ctx.textBaseline = 'middle';

  const words = trimmed.split(/\s+/);
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
      ? node.frame.width - padding
      : node.frame.width / 2;
  const yStart = node.frame.height / 2 - totalHeight / 2;
  visibleLines.forEach((line, index) => {
    ctx.fillText?.(line, x, yStart + index * lineHeight, maxWidth);
  });
  return true;
}

function drawImageCover(
  ctx: CanvasRenderingContext2D,
  src: string,
  width: number,
  height: number,
  coverBlur: number,
  shouldPaint: () => boolean,
): boolean {
  const url = src.trim();
  if (!url || typeof Image === 'undefined') return false;
  const image = new Image();
  const transform = typeof ctx.getTransform === 'function' ? ctx.getTransform() : null;
  image.crossOrigin = 'anonymous';
  image.onload = () => {
    if (!shouldPaint()) return;
    ctx.save();
    if (transform && typeof ctx.setTransform === 'function') {
      ctx.setTransform(transform);
    }
    ctx.filter = coverBlur > 0 ? `blur(${Math.max(0, coverBlur)}px)` : 'none';
    ctx.drawImage(image, 0, 0, width, height);
    ctx.restore();
  };
  image.onerror = () => {
    if (!image.crossOrigin) return;
    image.crossOrigin = '';
    image.src = url;
  };
  image.src = url;
  return true;
}

function resolveScratchCoverLiveFrame({
  node,
  rootGroupId,
  ctx,
  playheadMs,
}: {
  node: WidgetNode;
  rootGroupId: string;
  ctx: RenderContext;
  playheadMs: number;
}): WidgetNode['frame'] {
  const liveFrame = getLiveWidgetFrame(node, playheadMs);
  let nextX = liveFrame.x;
  let nextY = liveFrame.y;
  let currentParentId = node.parentId;
  const visited = new Set<string>([node.id]);

  while (currentParentId && currentParentId !== rootGroupId && !visited.has(currentParentId)) {
    visited.add(currentParentId);
    const parent = ctx.widgetsById[currentParentId];
    if (!parent) break;
    const parentLiveFrame = getLiveWidgetFrame(parent, playheadMs);
    nextX += parentLiveFrame.x - parent.frame.x;
    nextY += parentLiveFrame.y - parent.frame.y;
    currentParentId = parent.parentId;
  }

  return {
    ...liveFrame,
    x: nextX,
    y: nextY,
  };
}

function resolveScratchCoverOpacity({
  node,
  rootGroupId,
  ctx,
  playheadMs,
}: {
  node: WidgetNode;
  rootGroupId: string;
  ctx: RenderContext;
  playheadMs: number;
}): number {
  let opacity = getLiveWidgetOpacity(node, playheadMs);
  let currentParentId = node.parentId;
  const visited = new Set<string>([node.id]);

  while (currentParentId && currentParentId !== rootGroupId && !visited.has(currentParentId)) {
    visited.add(currentParentId);
    const parent = ctx.widgetsById[currentParentId];
    if (!parent) break;
    opacity *= getLiveWidgetOpacity(parent, playheadMs);
    currentParentId = parent.parentId;
  }

  return Math.max(0, Math.min(1, opacity));
}

function paintScratchCoverWidget({
  canvasCtx,
  node,
  rootFrame,
  rootGroupId,
  renderCtx,
  playheadMs,
  excludedTargetIds,
  coverBlur,
  shouldPaint,
  visited,
}: {
  canvasCtx: CanvasRenderingContext2D;
  node: WidgetNode;
  rootFrame: WidgetNode['frame'];
  rootGroupId: string;
  renderCtx: RenderContext;
  playheadMs: number;
  excludedTargetIds: ReadonlySet<string>;
  coverBlur: number;
  shouldPaint: () => boolean;
  visited: Set<string>;
}): boolean {
  if (visited.has(node.id) || node.hidden || !isWidgetVisibleAt(node, playheadMs)) return false;
  visited.add(node.id);
  if (excludedTargetIds.has(node.id)) return false;

  const liveFrame = renderCtx.previewMode && renderCtx.isReproducing
    ? node.frame
    : resolveScratchCoverLiveFrame({ node, rootGroupId, ctx: renderCtx, playheadMs });
  const liveOpacity = renderCtx.previewMode && renderCtx.isReproducing
    ? Math.max(0, Math.min(1, Number(node.style.opacity ?? 1)))
    : resolveScratchCoverOpacity({ node, rootGroupId, ctx: renderCtx, playheadMs });
  const paintNode: WidgetNode = {
    ...node,
    frame: {
      ...node.frame,
      width: liveFrame.width,
      height: liveFrame.height,
    },
  };

  let painted = false;
  canvasCtx.save();
  canvasCtx.globalAlpha = Number.isFinite(Number(canvasCtx.globalAlpha))
    ? Number(canvasCtx.globalAlpha) * liveOpacity
    : liveOpacity;
  canvasCtx.translate?.(liveFrame.x - rootFrame.x + liveFrame.width / 2, liveFrame.y - rootFrame.y + liveFrame.height / 2);
  canvasCtx.rotate?.((liveFrame.rotation * Math.PI) / 180);
  canvasCtx.translate?.(-liveFrame.width / 2, -liveFrame.height / 2);

  if (node.type === 'group') {
    painted = drawCoverBackground(canvasCtx, paintNode, renderCtx) || painted;
  } else if (node.type === 'image' || node.type === 'hero-image') {
    painted = drawImageCover(
      canvasCtx,
      String(node.props.src ?? ''),
      liveFrame.width,
      liveFrame.height,
      coverBlur,
      shouldPaint,
    ) || painted;
  } else if (node.type === 'cta') {
    painted = drawCoverBackground(canvasCtx, paintNode, renderCtx) || painted;
    painted = drawCoverText(canvasCtx, String(node.props.text ?? node.name), paintNode, renderCtx) || painted;
  } else if (node.type === 'text' || node.type === 'badge') {
    painted = drawCoverBackground(canvasCtx, paintNode, renderCtx) || painted;
    painted = drawCoverText(canvasCtx, String(node.props.text ?? node.props.label ?? node.name), paintNode, renderCtx) || painted;
  } else if (node.type === 'shape') {
    painted = drawCoverBackground(canvasCtx, paintNode, renderCtx) || painted;
  } else {
    painted = drawCoverBackground(canvasCtx, paintNode, renderCtx) || painted;
  }

  canvasCtx.restore();

  if (node.type === 'group' && node.childIds?.length) {
    let childPainted = false;
    node.childIds
      .map((childId) => renderCtx.widgetsById[childId])
      .filter((child): child is WidgetNode => Boolean(child))
      .sort((left, right) => left.zIndex - right.zIndex)
      .forEach((child) => {
        childPainted = paintScratchCoverWidget({
          canvasCtx,
          node: child,
          rootFrame,
          rootGroupId,
          renderCtx,
          playheadMs,
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

function paintScratchGroupedCoverSnapshot({
  canvasCtx,
  root,
  renderCtx,
  playheadMs,
  excludedTargetIds,
  coverBlur,
  shouldPaint,
}: {
  canvasCtx: CanvasRenderingContext2D;
  root: WidgetNode;
  renderCtx: RenderContext;
  playheadMs: number;
  excludedTargetIds: ReadonlySet<string>;
  coverBlur: number;
  shouldPaint: () => boolean;
}): boolean {
  const rootFrame = root.frame;
  const visited = new Set<string>();
  let painted = false;
  (root.childIds ?? [])
    .map((childId) => renderCtx.widgetsById[childId])
    .filter((child): child is WidgetNode => Boolean(child))
    .sort((left, right) => left.zIndex - right.zIndex)
    .forEach((child) => {
      painted = paintScratchCoverWidget({
        canvasCtx,
        node: child,
        rootFrame,
        rootGroupId: root.id,
        renderCtx,
        playheadMs,
        excludedTargetIds,
        coverBlur,
        shouldPaint,
        visited,
      }) || painted;
    });
  return painted;
}

function paintScratchCoverCanvas({
  canvas,
  width,
  height,
  coverColor,
  coverBlur,
  paintCover,
}: {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  coverColor: string;
  coverBlur: number;
  paintCover?: (ctx: CanvasRenderingContext2D) => boolean;
}): { width: number; height: number; dpr: number } | null {
  const dpr = typeof window === 'undefined'
    ? 1
    : Math.max(1, Math.min(MAX_SCRATCH_DPR, Number(window.devicePixelRatio || 1)));
  const pixelWidth = Math.max(1, Math.round(width * dpr));
  const pixelHeight = Math.max(1, Math.round(height * dpr));
  if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
  if (canvas.height !== pixelHeight) canvas.height = pixelHeight;

  const ctx = get2dContext(canvas);
  if (!ctx) return null;

  if (typeof ctx.setTransform === 'function') {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  ctx.clearRect(0, 0, width, height);
  const paintedGroupedCover = paintCover?.(ctx) ?? false;
  if (!paintedGroupedCover) {
    ctx.filter = coverBlur > 0 ? `blur(${Math.max(0, coverBlur)}px)` : 'none';
    ctx.fillStyle = coverColor;
    const bleed = Math.max(0, coverBlur * 2);
    ctx.fillRect(-bleed, -bleed, width + bleed * 2, height + bleed * 2);
  }
  ctx.filter = 'none';

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
  if (!data.length) return 100;
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

function ScratchGroupRenderer({ node, ctx }: { node: WidgetNode; ctx: RenderContext }): JSX.Element {
  const previewMode = ctx.previewMode;
  const nodeId = node.id;
  const ctxRef = useLatestRef(ctx);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const progressCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasSizeRef = useRef({ width: 0, height: 0, dpr: 1 });
  const lastPointRef = useRef<ScratchPoint | null>(null);
  const pointerActiveRef = useRef(false);
  const hasScratchedRef = useRef(false);
  const scratchCompletedRef = useRef(false);
  const firedMilestoneIdsRef = useRef(new Set<string>());
  const [scratchCompleted, setScratchCompleted] = useState(false);
  const scratchRadius = Math.max(8, Number(node.props.scratchRadius ?? 22));
  const autoRevealThresholdPercent = Math.max(
    0,
    Math.min(100, Number(node.props.autoRevealThresholdPercent ?? DEFAULT_SCRATCH_AUTO_REVEAL_THRESHOLD)),
  );
  const coverBlur = Math.max(0, Number(node.props.coverBlur ?? 0));
  const coverColor = resolveScratchCoverColor(node, ctx);
  const boxShadow = shadowConfigToBoxShadow(readShadowFromStyle(node.style));
  const rawMilestones = Array.isArray(node.props.scratchMilestones)
    ? (node.props.scratchMilestones as ScratchMilestone[])
    : DEFAULT_SCRATCH_MILESTONES;
  const milestonesKey = rawMilestones
    .map((milestone) => `${milestone.id}:${milestone.thresholdPercent}:${milestone.emitTrigger}`)
    .join('|');
  const milestones = useMemo(
    () => [...rawMilestones].sort((left, right) => left.thresholdPercent - right.thresholdPercent),
    [milestonesKey],
  );

  const resetScratchCanvas = ({ force = false, clearCompletion = false } = {}) => {
    const shell = shellRef.current;
    const canvas = canvasRef.current;
    if (!shell || !canvas) return;
    if (scratchCompletedRef.current && !clearCompletion) return;
    if (hasScratchedRef.current && !force && !clearCompletion) return;

    const width = Math.max(1, Math.round(shell.clientWidth || node.frame.width || 1));
    const height = Math.max(1, Math.round(shell.clientHeight || node.frame.height || 1));
    const dimensionsChanged = canvasSizeRef.current.width !== width || canvasSizeRef.current.height !== height;
    if (!force && !dimensionsChanged) return;

    const currentCtx = ctxRef.current;
    const excludedTargetIds = resolveScratchInternalTargetIds(node, currentCtx.widgetsById);
    const playheadMs = currentCtx.previewMode && currentCtx.isReproducing
      ? playbackEngine.getCurrentMs()
      : currentCtx.playheadMs;
    const paintedSize = paintScratchCoverCanvas({
      canvas,
      width,
      height,
      coverColor,
      coverBlur,
      paintCover: (canvasCtx) => paintScratchGroupedCoverSnapshot({
        canvasCtx,
        root: node,
        renderCtx: currentCtx,
        playheadMs,
        excludedTargetIds,
        coverBlur,
        shouldPaint: () => !scratchCompletedRef.current && !hasScratchedRef.current,
      }),
    });
    if (!paintedSize) return;
    canvasSizeRef.current = paintedSize;
    progressCanvasRef.current = createScratchProgressCanvas(width, height);
    lastPointRef.current = null;
    pointerActiveRef.current = false;
    hasScratchedRef.current = false;
    firedMilestoneIdsRef.current = new Set<string>();

    if (clearCompletion) {
      scratchCompletedRef.current = false;
      setScratchCompleted(false);
    }
  };

  const completeScratch = (clearedPercent: number) => {
    if (scratchCompletedRef.current) return;
    const completedAtMs = playbackEngine.getCurrentMs();
    scratchCompletedRef.current = true;
    pointerActiveRef.current = false;
    lastPointRef.current = null;
    setScratchCompleted(true);
    ctxRef.current.triggerWidgetAction('scratch-complete', {
      clearedPercent,
      thresholdPercent: autoRevealThresholdPercent,
      completedAtMs,
    });
  };

  const processScratchProgress = (clearedPercent: number) => {
    milestones.forEach((milestone) => {
      if (firedMilestoneIdsRef.current.has(milestone.id)) return;
      if (clearedPercent < milestone.thresholdPercent) return;
      firedMilestoneIdsRef.current.add(milestone.id);
    });

    if (autoRevealThresholdPercent > 0 && clearedPercent >= autoRevealThresholdPercent) {
      completeScratch(clearedPercent);
    }
  };

  const scratchAtEvent = (event: ReactPointerEvent<HTMLDivElement>) => {
    const shell = shellRef.current;
    const canvas = canvasRef.current;
    const progressCanvas = progressCanvasRef.current;
    if (!shell || !canvas || scratchCompletedRef.current) return;

    const rect = shell.getBoundingClientRect();
    const width = canvasSizeRef.current.width || Math.max(1, rect.width || node.frame.width || 1);
    const height = canvasSizeRef.current.height || Math.max(1, rect.height || node.frame.height || 1);
    const point = {
      x: Math.max(0, Math.min(width, ((event.clientX - rect.left) / Math.max(1, rect.width || width)) * width)),
      y: Math.max(0, Math.min(height, ((event.clientY - rect.top) / Math.max(1, rect.height || height)) * height)),
    };

    const ctx2d = get2dContext(canvas);
    if (ctx2d) {
      drawDestinationOutStroke(ctx2d, point, lastPointRef.current, scratchRadius);
    }
    const clearedPercent = progressCanvas
      ? eraseScratchProgress({
          progressCanvas,
          point,
          previousPoint: lastPointRef.current,
          radius: scratchRadius,
          width,
          height,
        })
      : 100;

    hasScratchedRef.current = true;
    lastPointRef.current = point;
    processScratchProgress(clearedPercent);
  };

  useLayoutEffect(() => {
    resetScratchCanvas({ force: true });
    return () => {
      progressCanvasRef.current = null;
      pointerActiveRef.current = false;
      lastPointRef.current = null;
    };
  }, [autoRevealThresholdPercent, coverBlur, coverColor, milestonesKey, nodeId, scratchRadius]);

  useLayoutEffect(() => {
    resetScratchCanvas({ force: false });
  }, [node.frame.height, node.frame.width, previewMode]);

  useEffect(() => {
    const shell = shellRef.current;
    if (!shell || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver((entries) => {
      if (scratchCompletedRef.current || hasScratchedRef.current) return;
      const entry = entries[0];
      const width = Math.max(1, Math.round(entry?.contentRect.width || shell.clientWidth || node.frame.width || 1));
      const height = Math.max(1, Math.round(entry?.contentRect.height || shell.clientHeight || node.frame.height || 1));
      const previous = canvasSizeRef.current;
      const widthDelta = Math.abs(width - previous.width) / Math.max(1, previous.width);
      const heightDelta = Math.abs(height - previous.height) / Math.max(1, previous.height);
      if (widthDelta < 0.05 && heightDelta < 0.05) return;
      resetScratchCanvas({ force: false });
    });
    observer.observe(shell);
    return () => observer.disconnect();
  }, [node.frame.height, node.frame.width, nodeId, previewMode]);

  useEffect(() => {
    if (!previewMode) return undefined;
    let previousPlayheadMs = playbackEngine.getCurrentMs();
    let previousPreviewMode = ctxRef.current.previewMode;

    const checkRewind = (nextMs: number) => {
      const nextPreviewMode = ctxRef.current.previewMode;
      if (!nextPreviewMode) {
        previousPlayheadMs = nextMs;
        previousPreviewMode = false;
        return;
      }
      if (nextPreviewMode === previousPreviewMode && nextMs === previousPlayheadMs) {
        return;
      }
      const enteredPreview = nextPreviewMode && !previousPreviewMode;
      const rewoundToStart = nextPreviewMode && nextMs === 0 && previousPlayheadMs > 0;
      previousPlayheadMs = nextMs;
      previousPreviewMode = nextPreviewMode;
      if (enteredPreview || rewoundToStart) {
        resetScratchCanvas({ force: true, clearCompletion: true });
      }
    };

    return playbackEngine.subscribeDom(checkRewind);
  }, [ctxRef, previewMode]);

  return (
    <div
      ref={shellRef}
      data-scratch-shell
      data-scratch-widget-id={nodeId}
      style={{ ...scratchShellStyle, borderRadius: Number(node.style.borderRadius ?? 18), boxShadow }}
    >
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        data-scratch-canvas
        data-scratch-cover-layer
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 1,
          width: '100%',
          height: '100%',
          opacity: scratchCompleted ? 0 : 1,
          pointerEvents: 'none',
          transition: 'opacity 120ms linear',
          WebkitTapHighlightColor: 'transparent',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 2,
          cursor: scratchCompleted ? 'default' : 'crosshair',
          touchAction: 'none',
          outline: 'none',
          background: 'transparent',
          WebkitTapHighlightColor: 'transparent',
          userSelect: 'none',
          pointerEvents: scratchCompleted ? 'none' : 'auto',
        }}
        data-scratch-hit-area
        data-scratch-completed={scratchCompleted ? 'true' : 'false'}
        onPointerDown={(event) => {
          if (scratchCompletedRef.current || event.isPrimary === false) return;
          event.preventDefault();
          event.stopPropagation();
          pointerActiveRef.current = true;
          lastPointRef.current = null;
          event.currentTarget.setPointerCapture?.(event.pointerId);
          scratchAtEvent(event);
        }}
        onPointerMove={(event) => {
          if (!pointerActiveRef.current || scratchCompletedRef.current) return;
          event.preventDefault();
          scratchAtEvent(event);
        }}
        onPointerUp={(event) => {
          pointerActiveRef.current = false;
          lastPointRef.current = null;
          event.currentTarget.releasePointerCapture?.(event.pointerId);
        }}
        onPointerCancel={(event) => {
          pointerActiveRef.current = false;
          lastPointRef.current = null;
          event.currentTarget.releasePointerCapture?.(event.pointerId);
        }}
        onLostPointerCapture={() => {
          pointerActiveRef.current = false;
          lastPointRef.current = null;
        }}
      />
    </div>
  );
}

function useScratchGroupActiveState(node: WidgetNode, ctx: RenderContext): boolean {
  const ctxRef = useLatestRef(ctx);
  const nodeRef = useLatestRef(node);
  const [active, setActive] = useState(() => isScratchGroupActive({
    group: node,
    widgetsById: ctx.widgetsById,
    playheadMs: ctx.playheadMs,
  }));

  useEffect(() => {
    if (!node.props.scratchEnabled) {
      setActive(false);
      return undefined;
    }

    const sync = (nextMs: number) => {
      const nextActive = isScratchGroupActive({
        group: nodeRef.current,
        widgetsById: ctxRef.current.widgetsById,
        playheadMs: nextMs,
      });
      setActive((current) => (current === nextActive ? current : nextActive));
    };

    if (!ctx.previewMode || !ctx.isReproducing) {
      sync(ctx.playheadMs);
      return undefined;
    }

    sync(playbackEngine.getCurrentMs());
    return playbackEngine.subscribeDom(sync);
  }, [
    ctx.previewMode,
    ctx.isReproducing,
    ctx.playheadMs,
    ctx.widgetsById,
    ctxRef,
    node.id,
    node.props.scratchEnabled,
    node.props.scratchActivationMode,
    node.props.scratchActivationDelayMs,
    node.timeline.startMs,
    nodeRef,
  ]);

  return active;
}

export function renderGroupWidget(node: WidgetNode, ctx: RenderContext): JSX.Element {
  if (!node.props.scratchEnabled) {
    return renderDefaultGroup(node, ctx);
  }

  if (!ctx.previewMode) {
    return <div style={scratchEditorOverlayStyle} />;
  }

  return <GroupScratchRoot node={node} ctx={ctx} />;
}

function GroupScratchRoot({ node, ctx }: { node: WidgetNode; ctx: RenderContext }): JSX.Element {
  const scratchGroupActive = useScratchGroupActiveState(node, ctx);
  if (!scratchGroupActive) {
    return renderDefaultGroup(node, ctx);
  }

  return <ScratchGroupRenderer node={node} ctx={ctx} />;
}
