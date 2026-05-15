import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { renderWidgetContents } from '../../canvas/stage/render-widget';
import { getLiveWidgetFrame, getLiveWidgetOpacity, isWidgetVisibleAt } from '../../domain/document/timeline';
import type { WidgetNode } from '../../domain/document/types';
import type { RenderContext } from '../../canvas/stage/render-context';
import { resolveWidgetBackground, resolveWidgetBorder, resolveWidgetColor, resolveWidgetOpacity } from '../../canvas/stage/render-helpers';

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

const scratchPointerLayerStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  zIndex: 2,
  cursor: 'crosshair',
  touchAction: 'none',
  outline: 'none',
  background: 'transparent',
  WebkitTapHighlightColor: 'transparent',
  userSelect: 'none',
};

const coverCompositionStyle: CSSProperties = {
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

function eraseScratchProgress(
  progressCanvas: HTMLCanvasElement,
  x: number,
  y: number,
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
  ctx.beginPath();
  ctx.arc(x * scaleX, y * scaleY, radius * Math.max(scaleX, scaleY), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const pixels = ctx.getImageData(0, 0, progressCanvas.width, progressCanvas.height).data;
  let cleared = 0;
  for (let index = 3; index < pixels.length; index += 4) {
    if (pixels[index] === 0) cleared += 1;
  }
  return (cleared / Math.max(1, progressCanvas.width * progressCanvas.height)) * 100;
}

function buildScratchMaskStyle(maskUrl: string, blur: number): CSSProperties {
  return {
    ...coverCompositionStyle,
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

function GroupScratchCoverChildren({ node, ctx }: { node: WidgetNode; ctx: RenderContext }): JSX.Element | null {
  const childWidgets = (node.childIds ?? [])
    .map((childId) => ctx.widgetsById[childId])
    .filter((child): child is WidgetNode => Boolean(child))
    .filter((child) => isWidgetVisibleAt(child, ctx.playheadMs))
    .sort((left, right) => left.zIndex - right.zIndex);

  if (!childWidgets.length) return null;

  return (
    <>
      {childWidgets.map((child) => {
        const liveFrame = getLiveWidgetFrame(child, ctx.playheadMs);
        const relativeLeft = liveFrame.x - node.frame.x;
        const relativeTop = liveFrame.y - node.frame.y;
        const childOpacity = getLiveWidgetOpacity(child, ctx.playheadMs);
        return (
          <div
            key={child.id}
            style={{
              position: 'absolute',
              left: relativeLeft,
              top: relativeTop,
              width: liveFrame.width,
              height: liveFrame.height,
              opacity: childOpacity,
              zIndex: child.zIndex,
              transform: `rotate(${liveFrame.rotation}deg)`,
              transformOrigin: 'center',
              pointerEvents: 'none',
            }}
          >
            {renderWidgetContents(
              child,
              {
                ...ctx,
                hovered: false,
                active: false,
              },
            )}
          </div>
        );
      })}
    </>
  );
}

function ScratchGroupRenderer({ node, ctx }: { node: WidgetNode; ctx: RenderContext }): JSX.Element {
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const progressCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const pointerActiveRef = useRef(false);
  const previousPreviewModeRef = useRef(ctx.previewMode);
  const previousPlayheadRef = useRef(ctx.playheadMs);
  const [maskUrl, setMaskUrl] = useState('');
  const [scratchCompleted, setScratchCompleted] = useState(false);
  const scratchRadius = Math.max(8, Number(node.props.scratchRadius ?? 22));
  const autoRevealThresholdPercent = Math.max(0, Math.min(100, Number(node.props.autoRevealThresholdPercent ?? 10)));
  const coverBlur = Math.max(0, Number(node.props.coverBlur ?? 0));

  const syncMaskPreview = () => {
    const canvas = maskCanvasRef.current;
    if (!canvas) return;
    setMaskUrl(canvas.toDataURL('image/png'));
  };

  const resetScratchMask = () => {
    const canvas = maskCanvasRef.current;
    if (!canvas) return;
    const width = Math.max(1, Math.round(canvas.clientWidth));
    const height = Math.max(1, Math.round(canvas.clientHeight));
    canvas.width = width;
    canvas.height = height;
    initializeScratchMask(canvas);
    progressCanvasRef.current = createScratchProgressCanvas(width, height);
    setScratchCompleted(false);
    syncMaskPreview();
  };

  useEffect(() => {
    resetScratchMask();
  }, [node.frame.width, node.frame.height, ctx.previewMode]);

  useEffect(() => {
    const enteredPreview = ctx.previewMode && !previousPreviewModeRef.current;
    const rewoundToStart = ctx.previewMode && ctx.playheadMs === 0 && previousPlayheadRef.current > 0;
    previousPreviewModeRef.current = ctx.previewMode;
    previousPlayheadRef.current = ctx.playheadMs;
    if (!enteredPreview && !rewoundToStart) return;
    resetScratchMask();
  }, [ctx.playheadMs, ctx.previewMode]);

  const scratchAtEvent = (event: ReactPointerEvent<HTMLDivElement>) => {
    const canvas = maskCanvasRef.current;
    if (!canvas || scratchCompleted) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / Math.max(1, rect.width)) * canvas.width;
    const y = ((event.clientY - rect.top) / Math.max(1, rect.height)) * canvas.height;
    eraseScratch(canvas, x, y, scratchRadius);
    syncMaskPreview();
    const progressCanvas = progressCanvasRef.current;
    if (!progressCanvas || autoRevealThresholdPercent <= 0) return;
    const clearedPercent = eraseScratchProgress(progressCanvas, x, y, scratchRadius, canvas.width, canvas.height);
    if (clearedPercent < autoRevealThresholdPercent) return;
    setScratchCompleted(true);
  };

  return (
    <div style={scratchShellStyle}>
      <canvas ref={maskCanvasRef} style={{ display: 'none' }} aria-hidden="true" />
      {!scratchCompleted && maskUrl ? (
        <div style={buildScratchMaskStyle(maskUrl, coverBlur)}>
          <GroupScratchCoverChildren node={node} ctx={ctx} />
        </div>
      ) : null}
      {!scratchCompleted ? (
        <div
          style={scratchPointerLayerStyle}
          onPointerDown={(event) => {
            if (!event.isPrimary) return;
            event.preventDefault();
            event.stopPropagation();
            pointerActiveRef.current = true;
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
            event.currentTarget.releasePointerCapture?.(event.pointerId);
          }}
          onPointerCancel={(event) => {
            pointerActiveRef.current = false;
            event.currentTarget.releasePointerCapture?.(event.pointerId);
          }}
          onLostPointerCapture={() => {
            pointerActiveRef.current = false;
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
    return <ScratchGroupRenderer node={node} ctx={ctx} />;
  }
  return renderDefaultGroup(node, ctx);
}
