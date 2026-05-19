// render-tokenized: brand/theme split enforced by lint-color-literals.mjs
import gsap from 'gsap';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { WidgetNode } from '../../domain/document/types';
import type { RenderContext } from '../../canvas/stage/render-context';
import { playbackEngine } from '../../hooks/use-playback-engine';
import { useLatestRef } from '../../shared/hooks';
import { getAccent, moduleShell, renderCollapsedIfNeeded } from './shared-styles';

const scratchRevealShellBaseStyle: CSSProperties = {
  position: 'relative',
  width: '100%',
  height: '100%',
  overflow: 'hidden',
};

const scratchRevealMediaStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  objectFit: 'cover',
};

export type ScratchRevealAnimationPreset = 'none' | 'appear' | 'fade-up' | 'zoom-in';

export function runScratchRevealRevealAnimation(
  node: HTMLImageElement | null,
  preset: ScratchRevealAnimationPreset,
  durationMs: number,
  delayMs: number,
): void {
  if (!node || preset === 'none') return;
  gsap.killTweensOf(node);
  const duration = Math.max(150, Math.min(3000, Number(durationMs || 700))) / 1000;
  const delay = Math.max(0, Math.min(3000, Number(delayMs || 0))) / 1000;
  const fromVars =
    preset === 'appear'
      ? { opacity: 0 }
      : preset === 'fade-up'
        ? { opacity: 0, y: 24 }
        : { opacity: 0.35, scale: 0.92 };
  const toVars =
    preset === 'appear'
      ? { opacity: 1 }
      : preset === 'fade-up'
        ? { opacity: 1, y: 0 }
        : { opacity: 1, scale: 1 };

  gsap.fromTo(node, fromVars, {
    ...toVars,
    duration,
    delay,
    ease: 'power2.out',
    overwrite: 'auto',
    force3D: true,
    immediateRender: true,
  });
}

const scratchRevealTitleStyle: CSSProperties = {
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

const scratchRevealLabelBaseStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'grid',
  placeItems: 'center',
  fontWeight: 800,
  fontSize: 22,
  textAlign: 'center',
  padding: 16,
  textShadow: '0 2px 14px rgba(15, 23, 42, 0.5)',
  pointerEvents: 'none',
};

const scratchRevealCanvasBaseStyle: CSSProperties = {
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

const scratchRevealFooterStyle: CSSProperties = {
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

const scratchRevealCoverLabelStyle: CSSProperties = {
  fontSize: 12,
};

function buildScratchRevealShellStyle(node: WidgetNode, ctx: RenderContext, background: string): CSSProperties {
  return {
    ...moduleShell(node, ctx),
    ...scratchRevealShellBaseStyle,
    background,
  };
}

function buildScratchRevealCanvasStyle(coverReady: boolean): CSSProperties {
  return {
    ...scratchRevealCanvasBaseStyle,
    opacity: coverReady ? 1 : 0,
  };
}

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
  const theme = typeof window !== 'undefined' ? window.getComputedStyle(document.documentElement) : null;
  const fallbackSurface = theme?.getPropertyValue('--surface-card-muted').trim() || 'hsl(210 40% 98%)';

  const fallback = () => {
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = fallbackSurface;
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

function commitScratchCover(
  liveCanvas: HTMLCanvasElement,
  paintedCanvas: HTMLCanvasElement,
): void {
  liveCanvas.width = paintedCanvas.width;
  liveCanvas.height = paintedCanvas.height;
  const ctx = liveCanvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, liveCanvas.width, liveCanvas.height);
  ctx.drawImage(paintedCanvas, 0, 0);
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

function clearScratchCompletion(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
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

function ScratchRevealModuleRenderer({ node, ctx }: { node: WidgetNode; ctx: RenderContext }): JSX.Element {
  const previewMode = ctx.previewMode;
  const ctxRef = useLatestRef(ctx);
  const accent = getAccent(node);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const revealMediaRef = useRef<HTMLImageElement | null>(null);
  const progressCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const repaintTokenRef = useRef(0);
  const pointerActiveRef = useRef(false);
  const scratchCompletedRef = useRef(false);
  const lastScratchPointRef = useRef<{ x: number; y: number } | null>(null);
  const [coverReady, setCoverReady] = useState(false);
  const [revealAnimationTick, setRevealAnimationTick] = useState(0);
  const title = String(node.props.title ?? node.name);
  const coverLabel = String(node.props.coverLabel ?? 'Scratch to reveal');
  const revealLabel = String(node.props.revealLabel ?? '20% off today');
  const beforeImage = String(node.props.beforeImage ?? '');
  const afterImage = String(node.props.afterImage ?? '');
  const coverBlur = Math.max(0, Number(node.props.coverBlur ?? 0));
  const scratchRadius = Math.max(8, Number(node.props.scratchRadius ?? 22));
  const autoRevealThresholdPercent = Math.max(0, Math.min(100, Number(node.props.autoRevealThresholdPercent ?? 10)));
  const revealAnimationPreset = String(node.props.revealAnimationPreset ?? 'none') as ScratchRevealAnimationPreset;
  const revealAnimationDurationMs = Math.max(150, Math.min(3000, Number(node.props.revealAnimationDurationMs ?? 700)));
  const revealAnimationDelayMs = Math.max(0, Math.min(3000, Number(node.props.revealAnimationDelayMs ?? 0)));

  useEffect(() => {
    const repaintToken = repaintTokenRef.current + 1;
    repaintTokenRef.current = repaintToken;
    const canvas = canvasRef.current;
    if (!canvas) return;
    gsap.killTweensOf(revealMediaRef.current);
    const width = Math.max(1, Math.round(canvas.clientWidth));
    const height = Math.max(1, Math.round(canvas.clientHeight));
    progressCanvasRef.current = createScratchProgressCanvas(width, height);
    scratchCompletedRef.current = false;
    lastScratchPointRef.current = null;
    const bufferCanvas = document.createElement('canvas');
    bufferCanvas.width = width;
    bufferCanvas.height = height;
    paintScratchCover(bufferCanvas, beforeImage, coverBlur, accent, () => {
      if (repaintTokenRef.current !== repaintToken) return;
      const liveCanvas = canvasRef.current;
      if (!liveCanvas) return;
      commitScratchCover(liveCanvas, bufferCanvas);
      setCoverReady(true);
    });
  }, [beforeImage, coverBlur, accent, node.frame.width, node.frame.height, previewMode]);

  useEffect(() => {
    let previousPlayheadMs = playbackEngine.getCurrentMs();
    let previousPreviewMode = ctxRef.current.previewMode;

    const reset = () => {
      const repaintToken = repaintTokenRef.current + 1;
      repaintTokenRef.current = repaintToken;
      const canvas = canvasRef.current;
      if (!canvas) return;
      gsap.killTweensOf(revealMediaRef.current);
      const width = Math.max(1, Math.round(canvas.clientWidth));
      const height = Math.max(1, Math.round(canvas.clientHeight));
      progressCanvasRef.current = createScratchProgressCanvas(width, height);
      scratchCompletedRef.current = false;
      lastScratchPointRef.current = null;
      const bufferCanvas = document.createElement('canvas');
      bufferCanvas.width = width;
      bufferCanvas.height = height;
      paintScratchCover(bufferCanvas, beforeImage, coverBlur, accent, () => {
        if (repaintTokenRef.current !== repaintToken) return;
        const liveCanvas = canvasRef.current;
        if (!liveCanvas) return;
        commitScratchCover(liveCanvas, bufferCanvas);
        setCoverReady(true);
      });
    };

    const checkRewind = (nextMs: number) => {
      const nextPreviewMode = ctxRef.current.previewMode;
      const enteredPreview = nextPreviewMode && !previousPreviewMode;
      const rewoundToStart = nextPreviewMode && nextMs === 0 && previousPlayheadMs > 0;
      previousPlayheadMs = nextMs;
      previousPreviewMode = nextPreviewMode;
      if (enteredPreview || rewoundToStart) {
        reset();
      }
    };

    return playbackEngine.subscribeDom(checkRewind);
  }, [accent, beforeImage, coverBlur, ctxRef]);

  useEffect(() => {
    if (!revealAnimationTick || !afterImage) return;
    runScratchRevealRevealAnimation(revealMediaRef.current, revealAnimationPreset, revealAnimationDurationMs, revealAnimationDelayMs);
  }, [afterImage, revealAnimationDelayMs, revealAnimationDurationMs, revealAnimationPreset, revealAnimationTick]);

  const scratchAtEvent = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (scratchCompletedRef.current) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((event.clientY - rect.top) / rect.height) * canvas.height;
    const point = { x, y };
    const previousPoint = lastScratchPointRef.current;
    eraseScratchStroke(canvas, previousPoint, point, scratchRadius);
    lastScratchPointRef.current = point;
    const progressCanvas = progressCanvasRef.current;
    if (!progressCanvas || autoRevealThresholdPercent <= 0) return;
    const clearedPercent = eraseScratchProgress(progressCanvas, previousPoint, point, scratchRadius, canvas.width, canvas.height);
    if (clearedPercent < autoRevealThresholdPercent) return;
    scratchCompletedRef.current = true;
    lastScratchPointRef.current = null;
    clearScratchCompletion(canvas);
    setRevealAnimationTick((current) => current + 1);
    ctx.triggerWidgetAction('scratch-complete', {
      clearedPercent,
        thresholdPercent: autoRevealThresholdPercent,
      completedAtMs: playbackEngine.getCurrentMs(),
    });
  };

  const revealBackground = useMemo(() => (
    afterImage
      ? undefined
      : `linear-gradient(135deg, ${accent}22, var(--white-a-12))`
  ), [afterImage, accent]);

  return (
    <div style={buildScratchRevealShellStyle(node, ctx, revealBackground ?? 'var(--neutral-slate-900)')}>
      {afterImage ? <img ref={revealMediaRef} src={afterImage} alt={revealLabel} decoding="async" style={scratchRevealMediaStyle} /> : null}
      <div style={scratchRevealTitleStyle}>{title}</div>
      <div style={scratchRevealLabelBaseStyle}>{revealLabel}</div>
      <canvas
        ref={canvasRef}
        style={buildScratchRevealCanvasStyle(coverReady)}
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
      <div style={scratchRevealFooterStyle}>
        <div style={scratchRevealCoverLabelStyle}>{coverLabel}</div>
      </div>
    </div>
  );
}

export function renderScratchRevealStage(node: WidgetNode, ctx: RenderContext): JSX.Element {
  const collapsed = renderCollapsedIfNeeded(node, ctx);
  if (collapsed) return collapsed;
  return <ScratchRevealModuleRenderer node={node} ctx={ctx} />;
}
