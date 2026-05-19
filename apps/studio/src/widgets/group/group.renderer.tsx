import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { getLiveWidgetFrame, getLiveWidgetOpacity, isWidgetVisibleAt } from '../../domain/document/timeline';
import type { WidgetNode } from '../../domain/document/types';
import type { RenderContext } from '../../canvas/stage/render-context';
import { resolveWidgetBackground, resolveWidgetBorder, resolveWidgetColor, resolveWidgetOpacity } from '../../canvas/stage/render-helpers';
import { renderWidgetContents } from '../../canvas/stage/render-widget';
import { playbackEngine } from '../../hooks/use-playback-engine';
import { MotionLayer } from '../../motion/react/MotionLayer';
import { useLatestRef } from '../../shared/hooks';
import { readShadowFromStyle, shadowConfigToBoxShadow } from '../../shared/style/shadow';
import { isScratchGroupActive } from './group-scratch-activation';
import { DEFAULT_SCRATCH_AUTO_REVEAL_THRESHOLD } from './group-scratch-constants';

type CssCanvasDocument = Document & {
  getCSSCanvasContext?: (
    contextId: '2d',
    name: string,
    width: number,
    height: number,
  ) => CanvasRenderingContext2D | null;
};

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

function getScratchCssCanvasContext(
  canvasName: string,
  width: number,
  height: number,
): CanvasRenderingContext2D | null {
  if (typeof document === 'undefined') return null;
  const attachCanvas = (context: CanvasRenderingContext2D | null): CanvasRenderingContext2D | null => {
    if (!context) return null;
    if ('canvas' in context && context.canvas) {
      context.canvas.width = width;
      context.canvas.height = height;
      return context;
    }
    const fallbackCanvas = document.createElement('canvas');
    fallbackCanvas.width = width;
    fallbackCanvas.height = height;
    Object.defineProperty(context, 'canvas', {
      configurable: true,
      value: fallbackCanvas,
    });
    return context;
  };
  const cssCanvasDocument = document as CssCanvasDocument;
  if (typeof cssCanvasDocument.getCSSCanvasContext === 'function') {
    return attachCanvas(cssCanvasDocument.getCSSCanvasContext('2d', canvasName, width, height));
  }
  const fallbackCanvas = document.createElement('canvas');
  fallbackCanvas.width = width;
  fallbackCanvas.height = height;
  return attachCanvas(fallbackCanvas.getContext('2d'));
}

function buildScratchMaskStyle(maskCanvasName: string, blur: number): CSSProperties {
  return {
    position: 'absolute',
    inset: 0,
    zIndex: 1,
    pointerEvents: 'none',
    filter: blur > 0 ? `blur(${blur}px)` : 'none',
    WebkitMaskImage: `-webkit-canvas(${maskCanvasName})`,
    maskImage: `-webkit-canvas(${maskCanvasName})`,
    WebkitMaskSize: '100% 100%',
    maskSize: '100% 100%',
    WebkitMaskRepeat: 'no-repeat',
    maskRepeat: 'no-repeat',
    WebkitMaskPosition: 'center',
    maskPosition: 'center',
  };
}

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

function renderScratchCoverNode(
  node: WidgetNode,
  rootFrame: WidgetNode['frame'],
  rootGroupId: string,
  ctx: RenderContext,
  playheadMs: number,
  visited = new Set<string>(),
): JSX.Element[] {
  if (visited.has(node.id) || !isWidgetVisibleAt(node, playheadMs)) return [];
  visited.add(node.id);

  if (node.type === 'group' && node.childIds?.length) {
    return node.childIds
      .map((childId) => ctx.widgetsById[childId])
      .filter((child): child is WidgetNode => Boolean(child))
      .sort((left, right) => left.zIndex - right.zIndex)
      .flatMap((child) => renderScratchCoverNode(child, rootFrame, rootGroupId, ctx, playheadMs, visited));
  }

  return [
    (
      <ScratchCoverWidget
        key={node.id}
        node={node}
        rootFrame={rootFrame}
        rootGroupId={rootGroupId}
        ctx={ctx}
        playheadMs={playheadMs}
      />
    ),
  ];
}

function ScratchCoverWidget({
  node,
  rootFrame,
  rootGroupId,
  ctx,
  playheadMs,
}: {
  node: WidgetNode;
  rootFrame: WidgetNode['frame'];
  rootGroupId: string;
  ctx: RenderContext;
  playheadMs: number;
}): JSX.Element {
  const liveFrame = ctx.previewMode && ctx.isReproducing
    ? node.frame
    : resolveScratchCoverLiveFrame({ node, rootGroupId, ctx, playheadMs });
  const liveOpacity = ctx.previewMode && ctx.isReproducing
    ? Math.max(0, Math.min(1, Number(node.style.opacity ?? 1)))
    : resolveScratchCoverOpacity({ node, rootGroupId, ctx, playheadMs });
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
      widgetsById={ctx.widgetsById}
      previewMode={ctx.previewMode}
      isReproducing={Boolean(ctx.isReproducing)}
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: liveFrame.width,
        height: liveFrame.height,
        opacity: liveOpacity,
        zIndex: node.zIndex,
        transform: `translate3d(${liveFrame.x - rootFrame.x}px, ${liveFrame.y - rootFrame.y}px, 0) rotate(${liveFrame.rotation}deg)`,
        transformOrigin: '0 0',
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
  playheadMs,
}: {
  node: WidgetNode;
  ctx: RenderContext;
  playheadMs: number;
}): JSX.Element | null {
  const childWidgets = (node.childIds ?? [])
    .map((childId) => ctx.widgetsById[childId])
    .filter((child): child is WidgetNode => Boolean(child))
    .sort((left, right) => left.zIndex - right.zIndex);

  const scratchNodes = childWidgets.flatMap((child) => renderScratchCoverNode(child, node.frame, node.id, ctx, playheadMs));
  if (!scratchNodes.length) return null;

  return <>{scratchNodes}</>;
}

function ScratchGroupRenderer({ node, ctx }: { node: WidgetNode; ctx: RenderContext }): JSX.Element {
  const playheadMs = ctx.playheadMs;
  const previewMode = ctx.previewMode;
  const nodeId = node.id;
  const ctxRef = useLatestRef(ctx);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const maskContextRef = useRef<CanvasRenderingContext2D | null>(null);
  const progressCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const pointerActiveRef = useRef(false);
  const scratchCompletedRef = useRef(false);
  const lastScratchPointRef = useRef<{ x: number; y: number } | null>(null);
  const maskSizeRef = useRef({ width: 0, height: 0 });
  const pendingResizeResetRef = useRef(false);
  const maskCanvasNameRef = useRef(`smx-scratch-mask-${nodeId}-${Math.random().toString(36).slice(2, 10)}`);
  const [scratchCompleted, setScratchCompleted] = useState(false);
  const scratchRadius = Math.max(8, Number(node.props.scratchRadius ?? 22));
  const autoRevealThresholdPercent = Math.max(
    0,
    Math.min(100, Number(node.props.autoRevealThresholdPercent ?? DEFAULT_SCRATCH_AUTO_REVEAL_THRESHOLD)),
  );
  const coverBlur = Math.max(0, Number(node.props.coverBlur ?? 0));
  const boxShadow = shadowConfigToBoxShadow(readShadowFromStyle(node.style));

  const resetScratchMask = ({ force = false } = {}) => {
    const shell = shellRef.current;
    const width = Math.max(1, Math.round(shell?.clientWidth ?? node.frame.width ?? 1));
    const height = Math.max(1, Math.round(shell?.clientHeight ?? node.frame.height ?? 1));
    const dimensionsChanged = maskSizeRef.current.width !== width || maskSizeRef.current.height !== height;
    if (!force && !dimensionsChanged) return;
    if (!force && (pointerActiveRef.current || scratchCompletedRef.current)) return;
    const maskContext = getScratchCssCanvasContext(maskCanvasNameRef.current, width, height);
    if (!maskContext) return;
    maskContextRef.current = maskContext;
    const canvas = maskContext.canvas;
    maskSizeRef.current = { width, height };
    canvas.width = width;
    canvas.height = height;
    initializeScratchMask(canvas);
    progressCanvasRef.current = createScratchProgressCanvas(width, height);
    scratchCompletedRef.current = false;
    pendingResizeResetRef.current = false;
    lastScratchPointRef.current = null;
    setScratchCompleted(false);
  };

  const flushPendingResizeReset = () => {
    if (!pendingResizeResetRef.current) return;
    if (pointerActiveRef.current || scratchCompletedRef.current) return;
    pendingResizeResetRef.current = false;
    resetScratchMask();
  };

  useLayoutEffect(() => {
    resetScratchMask({ force: true });
  }, [node.frame.width, node.frame.height, previewMode]);

  useEffect(() => {
    const shell = shellRef.current;
    if (!shell || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(() => {
      if (pointerActiveRef.current || scratchCompletedRef.current) {
        pendingResizeResetRef.current = true;
        return;
      }
      resetScratchMask();
      pendingResizeResetRef.current = false;
    });
    observer.observe(shell);
    return () => observer.disconnect();
  }, [nodeId, previewMode]);

  useEffect(() => {
    let previousPlayheadMs = playbackEngine.getCurrentMs();
    let previousPreviewMode = ctxRef.current.previewMode;

    const checkRewind = (nextMs: number) => {
      const previewMode = ctxRef.current.previewMode;
      const enteredPreview = previewMode && !previousPreviewMode;
      const rewoundToStart = previewMode && nextMs === 0 && previousPlayheadMs > 0;
      previousPlayheadMs = nextMs;
      previousPreviewMode = previewMode;
      if (enteredPreview || rewoundToStart) {
        resetScratchMask({ force: true });
      }
    };

    return playbackEngine.subscribeDom(checkRewind);
  }, [ctxRef]);

  const scratchAtEvent = (event: ReactPointerEvent<HTMLDivElement>) => {
    const canvas = maskContextRef.current?.canvas;
    if (!canvas || scratchCompleted) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / Math.max(1, rect.width)) * canvas.width;
    const y = ((event.clientY - rect.top) / Math.max(1, rect.height)) * canvas.height;
    const point = { x, y };
    const previousPoint = lastScratchPointRef.current;
    eraseScratchStroke(canvas, previousPoint, point, scratchRadius);
    const progressCanvas = progressCanvasRef.current;
    lastScratchPointRef.current = point;
    if (!progressCanvas || autoRevealThresholdPercent <= 0) return;
    const clearedPercent = eraseScratchProgress(progressCanvas, previousPoint, point, scratchRadius, canvas.width, canvas.height);
    if (clearedPercent < autoRevealThresholdPercent) return;
    const completedAtMs = playbackEngine.getCurrentMs();
    pointerActiveRef.current = false;
    scratchCompletedRef.current = true;
    lastScratchPointRef.current = null;
    setScratchCompleted(true);
    ctx.triggerWidgetAction('scratch-complete', {
      clearedPercent,
      thresholdPercent: autoRevealThresholdPercent,
      completedAtMs,
    });
  };

  const scratchContent = <GroupScratchCoverChildren node={node} ctx={ctx} playheadMs={playheadMs} />;

  return (
    <div ref={shellRef} style={{ ...scratchShellStyle, borderRadius: Number(node.style.borderRadius ?? 18), boxShadow }}>
      {scratchContent ? (
        <div style={scratchCompleted ? { display: 'none' } : { ...scratchRevealedContentStyle, ...buildScratchMaskStyle(maskCanvasNameRef.current, coverBlur) }}>
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
          data-scratch-hit-area
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
            flushPendingResizeReset();
          }}
          onPointerCancel={(event) => {
            pointerActiveRef.current = false;
            lastScratchPointRef.current = null;
            event.currentTarget.releasePointerCapture?.(event.pointerId);
            flushPendingResizeReset();
          }}
          onLostPointerCapture={() => {
            pointerActiveRef.current = false;
            lastScratchPointRef.current = null;
            flushPendingResizeReset();
          }}
        />
      ) : null}
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
  if (node.props.scratchEnabled) {
    const scratchGroupActive = useScratchGroupActiveState(node, ctx);
    if (!ctx.previewMode) {
      return <div style={scratchEditorOverlayStyle} />;
    }
    if (!scratchGroupActive) {
      return renderDefaultGroup(node, ctx);
    }
    return <ScratchGroupRenderer node={node} ctx={ctx} />;
  }
  return renderDefaultGroup(node, ctx);
}
