import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
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
  borderRadius: 18,
};

const scratchTitleStyle: CSSProperties = {
  position: 'absolute',
  top: 12,
  left: 12,
  right: 12,
  zIndex: 2,
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: '.04em',
  textTransform: 'uppercase',
  textShadow: '0 2px 14px rgba(15, 23, 42, 0.65)',
  pointerEvents: 'none',
};

const scratchFooterStyle: CSSProperties = {
  position: 'absolute',
  left: 12,
  right: 12,
  bottom: 12,
  zIndex: 2,
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  pointerEvents: 'none',
  textShadow: '0 2px 14px rgba(15, 23, 42, 0.65)',
};

const scratchCanvasBaseStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  zIndex: 1,
  width: '100%',
  height: '100%',
  cursor: 'crosshair',
  touchAction: 'none',
  outline: 'none',
  background: 'transparent',
  WebkitTapHighlightColor: 'transparent',
  userSelect: 'none',
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

  const fallback = () => {
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

  const renderImage = (image: HTMLImageElement) => {
    ctx.clearRect(0, 0, width, height);
    ctx.filter = coverBlur > 0 ? `blur(${Math.max(0, coverBlur)}px)` : 'none';
    ctx.drawImage(image, 0, 0, width, height);
    ctx.filter = 'none';
    onReady?.();
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
      fallback();
    };
    image.src = coverImage;
  };

  loadImage(true);
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

function ScratchGroupRenderer({ node, ctx }: { node: WidgetNode; ctx: RenderContext }): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const progressCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const pointerActiveRef = useRef(false);
  const scratchCompletedRef = useRef(false);
  const previousPreviewModeRef = useRef(ctx.previewMode);
  const previousPlayheadRef = useRef(ctx.playheadMs);
  const [coverReady, setCoverReady] = useState(false);
  const accent = String(node.style.accentColor ?? '#8b5cf6');
  const title = String(node.props.title ?? node.name);
  const coverLabel = String(node.props.coverLabel ?? 'Scratch to reveal');
  const beforeImage = String(node.props.beforeImage ?? '');
  const coverBlur = Math.max(0, Number(node.props.coverBlur ?? 0));
  const scratchRadius = Math.max(8, Number(node.props.scratchRadius ?? 22));
  const autoRevealThresholdPercent = Math.max(0, Math.min(100, Number(node.props.autoRevealThresholdPercent ?? 10)));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const width = Math.max(1, Math.round(canvas.clientWidth));
    const height = Math.max(1, Math.round(canvas.clientHeight));
    canvas.width = width;
    canvas.height = height;
    progressCanvasRef.current = createScratchProgressCanvas(width, height);
    scratchCompletedRef.current = false;
    setCoverReady(false);
    paintScratchCover(canvas, beforeImage, coverBlur, accent, () => setCoverReady(true));
  }, [accent, beforeImage, coverBlur, node.frame.width, node.frame.height, ctx.previewMode]);

  useEffect(() => {
    const enteredPreview = ctx.previewMode && !previousPreviewModeRef.current;
    const rewoundToStart = ctx.previewMode && ctx.playheadMs === 0 && previousPlayheadRef.current > 0;
    previousPreviewModeRef.current = ctx.previewMode;
    previousPlayheadRef.current = ctx.playheadMs;
    if (!enteredPreview && !rewoundToStart) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const width = Math.max(1, Math.round(canvas.clientWidth));
    const height = Math.max(1, Math.round(canvas.clientHeight));
    canvas.width = width;
    canvas.height = height;
    progressCanvasRef.current = createScratchProgressCanvas(width, height);
    scratchCompletedRef.current = false;
    setCoverReady(false);
    paintScratchCover(canvas, beforeImage, coverBlur, accent, () => setCoverReady(true));
  }, [accent, beforeImage, coverBlur, ctx.playheadMs, ctx.previewMode]);

  const scratchAtEvent = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || scratchCompletedRef.current) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((event.clientY - rect.top) / rect.height) * canvas.height;
    eraseScratch(canvas, x, y, scratchRadius);
    const progressCanvas = progressCanvasRef.current;
    if (!progressCanvas || autoRevealThresholdPercent <= 0) return;
    const clearedPercent = eraseScratchProgress(progressCanvas, x, y, scratchRadius, canvas.width, canvas.height);
    if (clearedPercent < autoRevealThresholdPercent) return;
    scratchCompletedRef.current = true;
    const context = canvas.getContext('2d');
    context?.clearRect(0, 0, canvas.width, canvas.height);
  };

  return (
    <div style={scratchShellStyle}>
      <div style={{ ...scratchTitleStyle, color: accent }}>{title}</div>
      <canvas
        ref={canvasRef}
        style={{ ...scratchCanvasBaseStyle, opacity: coverReady ? 1 : 0 }}
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
      <div style={scratchFooterStyle}>
        <div style={{ fontSize: 12, color: resolveWidgetColor(node, ctx) }}>{coverLabel}</div>
      </div>
    </div>
  );
}

export function renderGroupWidget(node: WidgetNode, ctx: RenderContext): JSX.Element {
  if (node.props.scratchEnabled) return <ScratchGroupRenderer node={node} ctx={ctx} />;
  return renderDefaultGroup(node, ctx);
}
