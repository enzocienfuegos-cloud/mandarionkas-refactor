// render-tokenized: brand/theme split enforced by lint-color-literals.mjs
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { WidgetNode } from '../../domain/document/types';
import type { RenderContext } from '../../canvas/stage/render-context';
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

type ScratchRevealAnimationPreset = 'none' | 'appear' | 'fade-up' | 'zoom-in';

function runScratchRevealRevealAnimation(
  node: HTMLImageElement | null,
  preset: ScratchRevealAnimationPreset,
  durationMs: number,
  delayMs: number,
): void {
  if (!node || preset === 'none' || typeof node.animate !== 'function') return;
  node.getAnimations?.().forEach((animation) => animation.cancel());
  const duration = Math.max(150, Math.min(3000, Number(durationMs || 700)));
  const delay = Math.max(0, Math.min(3000, Number(delayMs || 0)));
  const keyframes =
    preset === 'appear'
      ? [{ opacity: 0 }, { opacity: 1 }]
      : preset === 'fade-up'
        ? [{ opacity: 0, transform: 'translateY(24px)' }, { opacity: 1, transform: 'translateY(0px)' }]
        : [{ opacity: 0.35, transform: 'scale(0.92)' }, { opacity: 1, transform: 'scale(1)' }];
  node.animate(keyframes, { duration, delay, easing: 'ease-out', fill: 'backwards' });
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

function clearScratchCompletion(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
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

function ScratchRevealModuleRenderer({ node, ctx }: { node: WidgetNode; ctx: RenderContext }): JSX.Element {
  const accent = getAccent(node);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const revealMediaRef = useRef<HTMLImageElement | null>(null);
  const progressCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const pointerActiveRef = useRef(false);
  const scratchCompletedRef = useRef(false);
  const previousPreviewModeRef = useRef(ctx.previewMode);
  const previousPlayheadRef = useRef(ctx.playheadMs);
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
    const canvas = canvasRef.current;
    if (!canvas) return;
    revealMediaRef.current?.getAnimations?.().forEach((animation) => animation.cancel());
    const width = Math.max(1, Math.round(canvas.clientWidth));
    const height = Math.max(1, Math.round(canvas.clientHeight));
    canvas.width = width;
    canvas.height = height;
    progressCanvasRef.current = createScratchProgressCanvas(width, height);
    scratchCompletedRef.current = false;
    setCoverReady(false);
    paintScratchCover(canvas, beforeImage, coverBlur, accent, () => setCoverReady(true));
  }, [beforeImage, coverBlur, accent, node.frame.width, node.frame.height, ctx.previewMode]);

  useEffect(() => {
    const enteredPreview = ctx.previewMode && !previousPreviewModeRef.current;
    const rewoundToStart = ctx.previewMode && ctx.playheadMs === 0 && previousPlayheadRef.current > 0;
    previousPreviewModeRef.current = ctx.previewMode;
    previousPlayheadRef.current = ctx.playheadMs;
    if (!enteredPreview && !rewoundToStart) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    revealMediaRef.current?.getAnimations?.().forEach((animation) => animation.cancel());
    const width = Math.max(1, Math.round(canvas.clientWidth));
    const height = Math.max(1, Math.round(canvas.clientHeight));
    canvas.width = width;
    canvas.height = height;
    progressCanvasRef.current = createScratchProgressCanvas(width, height);
    scratchCompletedRef.current = false;
    setCoverReady(false);
    paintScratchCover(canvas, beforeImage, coverBlur, accent, () => setCoverReady(true));
  }, [accent, beforeImage, coverBlur, ctx.playheadMs, ctx.previewMode]);

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
    eraseScratch(canvas, x, y, scratchRadius);
    const progressCanvas = progressCanvasRef.current;
    if (!progressCanvas || autoRevealThresholdPercent <= 0) return;
    const clearedPercent = eraseScratchProgress(progressCanvas, x, y, scratchRadius, canvas.width, canvas.height);
    if (clearedPercent < autoRevealThresholdPercent) return;
    scratchCompletedRef.current = true;
    clearScratchCompletion(canvas);
    setRevealAnimationTick((current) => current + 1);
  };

  const revealBackground = useMemo(() => (
    afterImage
      ? undefined
      : `linear-gradient(135deg, ${accent}22, var(--white-a-12))`
  ), [afterImage, accent]);

  return (
    <div style={buildScratchRevealShellStyle(node, ctx, revealBackground ?? 'var(--neutral-slate-900)')}>
      {afterImage ? <img ref={revealMediaRef} src={afterImage} alt={revealLabel} style={scratchRevealMediaStyle} /> : null}
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
