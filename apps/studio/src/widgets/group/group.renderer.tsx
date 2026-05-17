import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { getLiveWidgetFrame, getLiveWidgetOpacity, isWidgetVisibleAt } from '../../domain/document/timeline';
import type { WidgetNode } from '../../domain/document/types';
import type { RenderContext } from '../../canvas/stage/render-context';
import { resolveWidgetBackground, resolveWidgetBorder, resolveWidgetColor, resolveWidgetOpacity } from '../../canvas/stage/render-helpers';
import { renderWidgetContents } from '../../canvas/stage/render-widget';
import { MotionLayer } from '../../motion/react/MotionLayer';
import { isScratchGroupActive } from './group-scratch-activation';

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

const scratchCanvasStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  opacity: 0,
  pointerEvents: 'none',
};

const scratchRevealedContentStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  zIndex: 1,
  pointerEvents: 'none',
};

function createScratchProgressCanvas(width: number, height: number): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(16, Math.min(96, Math.round(width / 4)));
  canvas.height = Math.max(16, Math.min(96, Math.round(height / 4)));
  const ctx = canvas.getContext('2d');
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

function eraseScratch(canvas: HTMLCanvasElement, x: number, y: number, radius: number): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
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
  const ctx = progressCanvas.getContext('2d');
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

function buildScratchMaskStyle(maskUrl: string, blur: number): CSSProperties {
  return {
    position: 'absolute',
    inset: 0,
    zIndex: 1,
    pointerEvents: 'none',
    filter: blur > 0 ? `blur(${blur}px)` : 'none',
    WebkitMaskImage: `url("${maskUrl}")`,
    maskImage: `url("${maskUrl}")`,
    WebkitMaskSize: '100% 100%',
    maskSize: '100% 100%',
    WebkitMaskRepeat: 'no-repeat',
    maskRepeat: 'no-repeat',
    WebkitMaskPosition: 'center',
    maskPosition: 'center',
  };
}

function renderDefaultGroup(node: WidgetNode, ctx: RenderContext): JSX.Element {
  if (node.childIds?.length) {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          borderRadius: Number(node.style.borderRadius ?? 18),
          background: resolveWidgetBackground(node, 'transparent', ctx),
          opacity: resolveWidgetOpacity(node, ctx),
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
      }}
    >
      {String(node.props.title ?? node.name)}
    </div>
  );
}

function getScratchCoverEffectivePlayheadMs(
  node: WidgetNode,
  playheadMs: number,
  revealCompletedAtMs: number | undefined,
): number {
  if (revealCompletedAtMs === undefined) return playheadMs;
  return node.timeline.startMs + Math.max(0, playheadMs - revealCompletedAtMs);
}

function resolveScratchCoverLiveFrame({
  node,
  rootGroupId,
  ctx,
  revealCompletedAtMs,
}: {
  node: WidgetNode;
  rootGroupId: string;
  ctx: RenderContext;
  revealCompletedAtMs: number | undefined;
}): WidgetNode['frame'] {
  const effectivePlayheadMs = getScratchCoverEffectivePlayheadMs(node, ctx.playheadMs, revealCompletedAtMs);
  const liveFrame = getLiveWidgetFrame(node, effectivePlayheadMs);
  let nextX = liveFrame.x;
  let nextY = liveFrame.y;
  let currentParentId = node.parentId;
  const visited = new Set<string>([node.id]);

  while (currentParentId && currentParentId !== rootGroupId && !visited.has(currentParentId)) {
    visited.add(currentParentId);
    const parent = ctx.widgetsById[currentParentId];
    if (!parent) break;
    const parentPlayheadMs = getScratchCoverEffectivePlayheadMs(parent, ctx.playheadMs, revealCompletedAtMs);
    const parentLiveFrame = getLiveWidgetFrame(parent, parentPlayheadMs);
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
  revealCompletedAtMs,
}: {
  node: WidgetNode;
  rootGroupId: string;
  ctx: RenderContext;
  revealCompletedAtMs: number | undefined;
}): number {
  const effectivePlayheadMs = getScratchCoverEffectivePlayheadMs(node, ctx.playheadMs, revealCompletedAtMs);
  let opacity = getLiveWidgetOpacity(node, effectivePlayheadMs);
  let currentParentId = node.parentId;
  const visited = new Set<string>([node.id]);

  while (currentParentId && currentParentId !== rootGroupId && !visited.has(currentParentId)) {
    visited.add(currentParentId);
    const parent = ctx.widgetsById[currentParentId];
    if (!parent) break;
    const parentPlayheadMs = getScratchCoverEffectivePlayheadMs(parent, ctx.playheadMs, revealCompletedAtMs);
    opacity *= getLiveWidgetOpacity(parent, parentPlayheadMs);
    currentParentId = parent.parentId;
  }

  return Math.max(0, Math.min(1, opacity));
}

function resolveScratchCoverBaseFrame(node: WidgetNode): WidgetNode['frame'] {
  return node.frame;
}

function resolveScratchCoverBaseOpacity(node: WidgetNode): number {
  const opacity = Number(node.style.opacity ?? 1);
  return Number.isFinite(opacity) ? Math.max(0, Math.min(1, opacity)) : 1;
}

function renderScratchCoverNode(
  node: WidgetNode,
  rootFrame: WidgetNode['frame'],
  rootGroupId: string,
  ctx: RenderContext,
  revealCompletedAtMs: number | undefined,
  visited = new Set<string>(),
): JSX.Element[] {
  const effectivePlayheadMs = getScratchCoverEffectivePlayheadMs(node, ctx.playheadMs, revealCompletedAtMs);
  if (visited.has(node.id) || !isWidgetVisibleAt(node, effectivePlayheadMs)) return [];
  visited.add(node.id);

  if (node.type === 'group' && node.childIds?.length) {
    return node.childIds
      .map((childId) => ctx.widgetsById[childId])
      .filter((child): child is WidgetNode => Boolean(child))
      .sort((left, right) => left.zIndex - right.zIndex)
      .flatMap((child) => renderScratchCoverNode(child, rootFrame, rootGroupId, ctx, revealCompletedAtMs, visited));
  }

  return [
    (
      <ScratchCoverWidget
        key={node.id}
        node={node}
        rootFrame={rootFrame}
        rootGroupId={rootGroupId}
        ctx={ctx}
        revealCompletedAtMs={revealCompletedAtMs}
      />
    ),
  ];
}

function ScratchCoverWidget({
  node,
  rootFrame,
  rootGroupId,
  ctx,
  revealCompletedAtMs,
}: {
  node: WidgetNode;
  rootFrame: WidgetNode['frame'];
  rootGroupId: string;
  ctx: RenderContext;
  revealCompletedAtMs?: number;
}): JSX.Element {
  const shouldReproduceMotion = Boolean(ctx.previewMode && ctx.isReproducing && revealCompletedAtMs !== undefined);
  const liveFrame = shouldReproduceMotion
    ? resolveScratchCoverBaseFrame(node)
    : resolveScratchCoverLiveFrame({ node, rootGroupId, ctx, revealCompletedAtMs });
  const liveOpacity = shouldReproduceMotion
    ? resolveScratchCoverBaseOpacity(node)
    : resolveScratchCoverOpacity({ node, rootGroupId, ctx, revealCompletedAtMs });
  const contentNode: WidgetNode = {
    ...node,
    frame: {
      ...liveFrame,
      x: 0,
      y: 0,
      rotation: 0,
    },
    style: {
      ...node.style,
      opacity: 1,
    },
  };

  return (
    <MotionLayer
      widget={node}
      playheadMs={ctx.playheadMs}
      isReproducing={shouldReproduceMotion}
      startedAtMs={revealCompletedAtMs}
      style={{
        position: 'absolute',
        left: liveFrame.x - rootFrame.x,
        top: liveFrame.y - rootFrame.y,
        width: liveFrame.width,
        height: liveFrame.height,
        opacity: liveOpacity,
        zIndex: node.zIndex,
        transform: `rotate(${liveFrame.rotation}deg)`,
        transformOrigin: 'center',
        pointerEvents: 'none',
      }}
    >
      {renderWidgetContents(
        contentNode,
        {
          ...ctx,
          hovered: false,
          active: false,
        },
      )}
    </MotionLayer>
  );
}

function GroupScratchCoverChildren({
  node,
  ctx,
  revealCompletedAtMs,
}: {
  node: WidgetNode;
  ctx: RenderContext;
  revealCompletedAtMs?: number;
}): JSX.Element | null {
  const childWidgets = (node.childIds ?? [])
    .map((childId) => ctx.widgetsById[childId])
    .filter((child): child is WidgetNode => Boolean(child))
    .sort((left, right) => left.zIndex - right.zIndex);

  const scratchNodes = childWidgets.flatMap((child) => renderScratchCoverNode(child, node.frame, node.id, ctx, revealCompletedAtMs));
  if (!scratchNodes.length) return null;

  return <>{scratchNodes}</>;
}

function ScratchGroupRenderer({ node, ctx }: { node: WidgetNode; ctx: RenderContext }): JSX.Element {
  const shellRef = useRef<HTMLDivElement | null>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const progressCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const pointerActiveRef = useRef(false);
  const scratchCompletedRef = useRef(false);
  const lastScratchPointRef = useRef<{ x: number; y: number } | null>(null);
  const maskSizeRef = useRef({ width: 0, height: 0 });
  const previousPreviewModeRef = useRef(ctx.previewMode);
  const previousPlayheadRef = useRef(ctx.playheadMs);
  const [maskUrl, setMaskUrl] = useState('');
  const [scratchCompleted, setScratchCompleted] = useState(false);
  const [scratchCompletedAtMs, setScratchCompletedAtMs] = useState<number | undefined>(undefined);
  const scratchRadius = Math.max(8, Number(node.props.scratchRadius ?? 22));
  const autoRevealThresholdPercent = Math.max(0, Math.min(100, Number(node.props.autoRevealThresholdPercent ?? 10)));
  const coverBlur = Math.max(0, Number(node.props.coverBlur ?? 0));

  const syncMaskPreview = () => {
    const canvas = maskCanvasRef.current;
    if (!canvas) return;
    setMaskUrl(canvas.toDataURL('image/png'));
  };

  const resetScratchMask = ({ force = false } = {}) => {
    const canvas = maskCanvasRef.current;
    const shell = shellRef.current;
    if (!canvas) return;
    const width = Math.max(1, Math.round(shell?.clientWidth ?? node.frame.width ?? 1));
    const height = Math.max(1, Math.round(shell?.clientHeight ?? node.frame.height ?? 1));
    const dimensionsChanged = maskSizeRef.current.width !== width || maskSizeRef.current.height !== height;
    if (!force && !dimensionsChanged) return;
    if (!force && (pointerActiveRef.current || scratchCompletedRef.current)) return;
    maskSizeRef.current = { width, height };
    canvas.width = width;
    canvas.height = height;
    initializeScratchMask(canvas);
    progressCanvasRef.current = createScratchProgressCanvas(width, height);
    scratchCompletedRef.current = false;
    lastScratchPointRef.current = null;
    setScratchCompleted(false);
    setScratchCompletedAtMs(undefined);
    syncMaskPreview();
  };

  useEffect(() => {
    resetScratchMask({ force: true });
  }, [node.frame.width, node.frame.height, ctx.previewMode]);

  useEffect(() => {
    const shell = shellRef.current;
    if (!shell || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(() => resetScratchMask());
    observer.observe(shell);
    return () => observer.disconnect();
  }, [ctx.previewMode, node.id]);

  useEffect(() => {
    const enteredPreview = ctx.previewMode && !previousPreviewModeRef.current;
    const rewoundToStart = ctx.previewMode && ctx.playheadMs === 0 && previousPlayheadRef.current > 0;
    previousPreviewModeRef.current = ctx.previewMode;
    previousPlayheadRef.current = ctx.playheadMs;
    if (!enteredPreview && !rewoundToStart) return;
    resetScratchMask({ force: true });
  }, [ctx.playheadMs, ctx.previewMode]);

  const scratchAtEvent = (event: ReactPointerEvent<HTMLDivElement>) => {
    const canvas = maskCanvasRef.current;
    if (!canvas || scratchCompleted) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / Math.max(1, rect.width)) * canvas.width;
    const y = ((event.clientY - rect.top) / Math.max(1, rect.height)) * canvas.height;
    const point = { x, y };
    const previousPoint = lastScratchPointRef.current;
    eraseScratchStroke(canvas, previousPoint, point, scratchRadius);
    syncMaskPreview();
    const progressCanvas = progressCanvasRef.current;
    lastScratchPointRef.current = point;
    if (!progressCanvas || autoRevealThresholdPercent <= 0) return;
    const clearedPercent = eraseScratchProgress(progressCanvas, previousPoint, point, scratchRadius, canvas.width, canvas.height);
    if (clearedPercent < autoRevealThresholdPercent) return;
    const completedAtMs = ctx.playheadMs;
    pointerActiveRef.current = false;
    scratchCompletedRef.current = true;
    lastScratchPointRef.current = null;
    setMaskUrl('');
    setScratchCompleted(true);
    setScratchCompletedAtMs(completedAtMs);
    ctx.triggerWidgetAction('scratch-complete', {
      clearedPercent,
      thresholdPercent: autoRevealThresholdPercent,
      completedAtMs,
    });
  };

  const scratchContent =
    maskUrl || scratchCompleted ? (
      <GroupScratchCoverChildren node={node} ctx={ctx} revealCompletedAtMs={scratchCompletedAtMs} />
    ) : null;

  return (
    <div ref={shellRef} style={scratchShellStyle}>
      <canvas ref={maskCanvasRef} style={scratchCanvasStyle} aria-hidden="true" />
      {scratchContent ? (
        <div style={!scratchCompleted && maskUrl ? buildScratchMaskStyle(maskUrl, coverBlur) : scratchRevealedContentStyle}>
          {scratchContent}
        </div>
      ) : null}
      {!scratchCompleted ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 2,
            cursor: 'crosshair',
            touchAction: 'none',
            outline: 'none',
            background: 'transparent',
            WebkitTapHighlightColor: 'transparent',
            userSelect: 'none',
          }}
          onPointerDown={(event) => {
            if (!event.isPrimary) return;
            event.preventDefault();
            event.stopPropagation();
            pointerActiveRef.current = true;
            lastScratchPointRef.current = null;
            event.currentTarget.setPointerCapture?.(event.pointerId);
            scratchAtEvent(event);
          }}
          onPointerMove={(event) => {
            event.preventDefault();
            if (!pointerActiveRef.current) return;
            scratchAtEvent(event);
          }}
          onPointerUp={(event) => {
            pointerActiveRef.current = false;
            lastScratchPointRef.current = null;
            event.currentTarget.releasePointerCapture?.(event.pointerId);
          }}
          onPointerCancel={(event) => {
            pointerActiveRef.current = false;
            lastScratchPointRef.current = null;
            event.currentTarget.releasePointerCapture?.(event.pointerId);
          }}
          onLostPointerCapture={() => {
            pointerActiveRef.current = false;
            lastScratchPointRef.current = null;
          }}
        />
      ) : null}
    </div>
  );
}

export function renderGroupWidget(node: WidgetNode, ctx: RenderContext): JSX.Element {
  if (node.props.scratchEnabled) {
    if (!ctx.previewMode) {
      return <div style={scratchEditorOverlayStyle} />;
    }
    if (!isScratchGroupActive({ group: node, widgetsById: ctx.widgetsById, playheadMs: ctx.playheadMs })) {
      return renderDefaultGroup(node, ctx);
    }
    return <ScratchGroupRenderer node={node} ctx={ctx} />;
  }
  return renderDefaultGroup(node, ctx);
}
