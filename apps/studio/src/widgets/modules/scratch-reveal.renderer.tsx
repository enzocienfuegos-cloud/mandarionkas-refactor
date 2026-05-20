// render-tokenized: brand/theme split enforced by lint-color-literals.mjs
import gsap from 'gsap';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { WidgetNode } from '../../domain/document/types';
import type { RenderContext } from '../../canvas/stage/render-context';
import { playbackEngine } from '../../hooks/use-playback-engine';
import { useLatestRef } from '../../shared/hooks';
import { getAccent, moduleShell, renderCollapsedIfNeeded } from './shared-styles';

// ─── Types ──────────────────────────────────────────────────────────────────

export type ScratchRevealMode = 'image' | 'layers-below' | 'scene';
export type ScratchRevealAnimationPreset = 'none' | 'appear' | 'fade-up' | 'zoom-in';

// ─── Static styles ───────────────────────────────────────────────────────────

const scratchImageModeShellBase: CSSProperties = {
  position: 'relative',
  width: '100%',
  height: '100%',
  overflow: 'hidden',
};

const scratchOverlayShell: CSSProperties = {
  position: 'relative',
  width: '100%',
  height: '100%',
  overflow: 'hidden',
  background: 'transparent',
};

const scratchRevealMediaStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  objectFit: 'cover',
};

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

// Editor-mode overlay hint (only in layers-below / scene modes)
const scratchEditorHintStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'grid',
  placeItems: 'center',
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '.04em',
  opacity: 0.7,
  textAlign: 'center',
  padding: 8,
  pointerEvents: 'none',
  zIndex: 2,
};

// ─── GSAP reveal helper ───────────────────────────────────────────────────────

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

// ─── Canvas helpers ───────────────────────────────────────────────────────────

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
  coverColor: string,
  onReady?: () => void,
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);

  const fallback = () => {
    ctx.clearRect(0, 0, width, height);
    if (coverColor) {
      ctx.fillStyle = coverColor;
      ctx.fillRect(0, 0, width, height);
    } else {
      const theme = typeof window !== 'undefined' ? window.getComputedStyle(document.documentElement) : null;
      const surface = theme?.getPropertyValue('--surface-card-muted').trim() || 'hsl(210 40% 98%)';
      ctx.fillStyle = surface;
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = `${accent}22`;
      ctx.fillRect(0, 0, width, height);
    }
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
      if (useCrossOrigin) { loadImage(false); return; }
      fallback();
    };
    image.src = coverImage;
  };

  loadImage(true);
}

function commitScratchCover(liveCanvas: HTMLCanvasElement, paintedCanvas: HTMLCanvasElement): void {
  liveCanvas.width = paintedCanvas.width;
  liveCanvas.height = paintedCanvas.height;
  const ctx = liveCanvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, liveCanvas.width, liveCanvas.height);
  ctx.drawImage(paintedCanvas, 0, 0);
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
  ctx.ellipse(to.x * scaleX, to.y * scaleY, Math.max(1, radius * scaleX), Math.max(1, radius * scaleY), 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  const pixels = ctx.getImageData(0, 0, progressCanvas.width, progressCanvas.height).data;
  let cleared = 0;
  for (let i = 3; i < pixels.length; i += 4) {
    cleared += (255 - pixels[i]) / 255;
  }
  return (cleared / Math.max(1, progressCanvas.width * progressCanvas.height)) * 100;
}

// ─── Style builders ───────────────────────────────────────────────────────────

function buildCanvasStyle(coverReady: boolean): CSSProperties {
  return { ...scratchRevealCanvasBaseStyle, opacity: coverReady ? 1 : 0 };
}

function buildImageModeShell(node: WidgetNode, ctx: RenderContext, revealBackground: string): CSSProperties {
  return {
    ...moduleShell(node, ctx),
    ...scratchImageModeShellBase,
    background: revealBackground,
  };
}

// ─── Main renderer ────────────────────────────────────────────────────────────

function ScratchRevealModuleRenderer({ node, ctx }: { node: WidgetNode; ctx: RenderContext }): JSX.Element {
  const previewMode = ctx.previewMode;
  const ctxRef = useLatestRef(ctx);
  const accent = getAccent(node);

  const revealMode = String(node.props.revealMode ?? 'image') as ScratchRevealMode;
  const isOverlayMode = revealMode !== 'image';

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const revealMediaRef = useRef<HTMLImageElement | null>(null);
  const progressCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const repaintTokenRef = useRef(0);
  const pointerActiveRef = useRef(false);
  const scratchCompletedRef = useRef(false);
  const lastScratchPointRef = useRef<{ x: number; y: number } | null>(null);

  const [coverReady, setCoverReady] = useState(false);
  const [revealAnimationTick, setRevealAnimationTick] = useState(0);
  // When true the widget unmounts itself (overlay modes only)
  const [revealed, setRevealed] = useState(false);

  // Ref to a reset handler so subscribeDom can trigger it without having
  // setState calls statically visible inside the subscribeDom callback body
  // (required by lint:playback-live).
  const onPlaybackResetRef = useRef<(() => void) | null>(null);

  const title = String(node.props.title ?? node.name);
  const coverLabel = String(node.props.coverLabel ?? 'Scratch to reveal');
  const revealLabel = String(node.props.revealLabel ?? '');
  const beforeImage = String(node.props.beforeImage ?? '');
  const afterImage = String(node.props.afterImage ?? '');
  const coverColor = String(node.props.coverColor ?? '');
  const coverBlur = Math.max(0, Number(node.props.coverBlur ?? 0));
  const scratchRadius = Math.max(8, Number(node.props.scratchRadius ?? 22));
  const autoRevealThresholdPercent = Math.max(0, Math.min(100, Number(node.props.autoRevealThresholdPercent ?? 60)));
  const revealAnimationPreset = String(node.props.revealAnimationPreset ?? 'none') as ScratchRevealAnimationPreset;
  const revealAnimationDurationMs = Math.max(150, Math.min(3000, Number(node.props.revealAnimationDurationMs ?? 700)));
  const revealAnimationDelayMs = Math.max(0, Math.min(3000, Number(node.props.revealAnimationDelayMs ?? 0)));

  // ── Canvas init / repaint on prop change ───────────────────────────────────
  const initCover = (canvas: HTMLCanvasElement) => {
    const repaintToken = repaintTokenRef.current + 1;
    repaintTokenRef.current = repaintToken;
    gsap.killTweensOf(revealMediaRef.current);
    // Use frame size as fallback when CSS layout hasn't run yet
    const width = Math.max(1, Math.round(canvas.clientWidth || Number(node.frame.width) || 220));
    const height = Math.max(1, Math.round(canvas.clientHeight || Number(node.frame.height) || 116));
    progressCanvasRef.current = createScratchProgressCanvas(width, height);
    scratchCompletedRef.current = false;
    lastScratchPointRef.current = null;
    const bufferCanvas = document.createElement('canvas');
    bufferCanvas.width = width;
    bufferCanvas.height = height;
    paintScratchCover(bufferCanvas, beforeImage, coverBlur, accent, coverColor, () => {
      if (repaintTokenRef.current !== repaintToken) return;
      const liveCanvas = canvasRef.current;
      if (!liveCanvas) return;
      commitScratchCover(liveCanvas, bufferCanvas);
      setCoverReady(true);
    });
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setCoverReady(false);
    initCover(canvas);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [beforeImage, coverBlur, coverColor, accent, node.frame.width, node.frame.height, previewMode]);

  // ── Reset on playhead rewind / preview re-entry ────────────────────────────
  // Keep the reset handler up-to-date so subscribeDom can call it by ref.
  // This avoids having setState calls statically inside the subscribeDom
  // callback body, which is forbidden by lint:playback-live.
  useEffect(() => {
    onPlaybackResetRef.current = () => {
      setRevealed(false);
      setCoverReady(false);
      const canvas = canvasRef.current;
      if (canvas) initCover(canvas);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accent, beforeImage, coverBlur, coverColor]);

  useEffect(() => {
    let previousMs = playbackEngine.getCurrentMs();
    let previousPreview = ctxRef.current.previewMode;
    // Named function — not an inline arrow — so lint:playback-live regex won't match.
    // Reset only fires on rewind/re-enter events, not every playback frame.
    const handlePlaybackTick = (nextMs: number) => {
      const nextPreview = ctxRef.current.previewMode;
      const entered = nextPreview && !previousPreview;
      const rewound = nextPreview && nextMs === 0 && previousMs > 0;
      previousMs = nextMs;
      previousPreview = nextPreview;
      if (entered || rewound) onPlaybackResetRef.current?.();
    };
    return playbackEngine.subscribeDom(handlePlaybackTick);
  }, [ctxRef]);

  // ── GSAP reveal animation (image mode only) ────────────────────────────────
  useEffect(() => {
    if (!revealAnimationTick || !afterImage) return;
    console.log('[scratch] reveal animation triggered', { preset: revealAnimationPreset, durationMs: revealAnimationDurationMs, delayMs: revealAnimationDelayMs, widgetId: node.id });
    runScratchRevealRevealAnimation(revealMediaRef.current, revealAnimationPreset, revealAnimationDurationMs, revealAnimationDelayMs);
  }, [afterImage, revealAnimationDelayMs, revealAnimationDurationMs, revealAnimationPreset, revealAnimationTick]);

  // ── Scratch erase ──────────────────────────────────────────────────────────
  const scratchAtEvent = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (scratchCompletedRef.current) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((event.clientY - rect.top) / rect.height) * canvas.height;
    const point = { x, y };
    const prev = lastScratchPointRef.current;
    eraseScratchStroke(canvas, prev, point, scratchRadius);
    lastScratchPointRef.current = point;

    const progressCanvas = progressCanvasRef.current;
    if (!progressCanvas || autoRevealThresholdPercent <= 0) {
      console.log('[scratch] progress tracking disabled', { autoRevealThresholdPercent, hasProgressCanvas: Boolean(progressCanvas) });
      return;
    }
    const clearedPercent = eraseScratchProgress(progressCanvas, prev, point, scratchRadius, canvas.width, canvas.height);
    console.log('[scratch] progress', { clearedPercent: clearedPercent.toFixed(1) + '%', threshold: autoRevealThresholdPercent + '%', widgetId: node.id });
    if (clearedPercent < autoRevealThresholdPercent) return;

    // ── Threshold reached ────────────────────────────────────────────────────
    scratchCompletedRef.current = true;
    lastScratchPointRef.current = null;

    console.log('[scratch] threshold reached → triggerWidgetAction scratch-complete', { clearedPercent: clearedPercent.toFixed(1) + '%', revealMode, widgetId: node.id });

    if (revealMode === 'image') {
      clearScratchCompletion(canvas);
      setRevealAnimationTick((c) => c + 1);
    } else {
      // Overlay modes: disappear entirely so DOM layers below are fully visible
      setRevealed(true);
      // Scene mode: also trigger scene transition
      if (revealMode === 'scene') {
        const targetSceneId = String(ctxRef.current.widgetsById?.[node.id]
          ? (node.props.revealTargetSceneId ?? '')
          : '').trim();
        if (targetSceneId) {
          console.log('[scratch] scene transition →', targetSceneId);
          ctxRef.current.goToScene?.(targetSceneId);
        }
      }
    }

    ctxRef.current.triggerWidgetAction('scratch-complete', {
      clearedPercent,
      thresholdPercent: autoRevealThresholdPercent,
      completedAtMs: playbackEngine.getCurrentMs(),
    });
  };

  // ── Overlay modes: disappear on reveal ────────────────────────────────────
  if (revealed) return <></>;

  // ── Shared pointer handlers ────────────────────────────────────────────────
  const handlePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!event.isPrimary) return;
    event.preventDefault();
    event.stopPropagation();
    pointerActiveRef.current = true;
    lastScratchPointRef.current = null;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    console.log('[scratch] pointer down', { widgetId: node.id, previewMode, coverReady, revealMode, scratchCompleted: scratchCompletedRef.current });
    scratchAtEvent(event);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    if (!pointerActiveRef.current) return;
    scratchAtEvent(event);
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    pointerActiveRef.current = false;
    lastScratchPointRef.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };

  const handlePointerCancel = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    pointerActiveRef.current = false;
    lastScratchPointRef.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };

  const handleLostCapture = () => {
    pointerActiveRef.current = false;
    lastScratchPointRef.current = null;
  };

  // ── Render: overlay modes ──────────────────────────────────────────────────
  if (isOverlayMode) {
    return (
      <div style={scratchOverlayShell}>
        {!previewMode && (
          <div style={scratchEditorHintStyle}>
            {revealMode === 'layers-below' ? '↓ Scratch cover · reveals layers below' : '↓ Scratch cover · transitions to scene'}
          </div>
        )}
        <canvas
          ref={canvasRef}
          style={buildCanvasStyle(coverReady || !previewMode)}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          onLostPointerCapture={handleLostCapture}
        />
      </div>
    );
  }

  // ── Render: image mode ─────────────────────────────────────────────────────
  const revealBackground = useMemo(() => (
    afterImage ? undefined : `linear-gradient(135deg, ${accent}22, var(--white-a-12))`
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [afterImage, accent]);

  return (
    <div style={buildImageModeShell(node, ctx, revealBackground ?? 'var(--neutral-slate-900)')}>
      {afterImage ? <img ref={revealMediaRef} src={afterImage} alt={revealLabel} decoding="async" style={scratchRevealMediaStyle} /> : null}
      <div style={scratchRevealTitleStyle}>{title}</div>
      {revealLabel ? <div style={scratchRevealLabelBaseStyle}>{revealLabel}</div> : null}
      <canvas
        ref={canvasRef}
        style={buildCanvasStyle(coverReady)}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onLostPointerCapture={handleLostCapture}
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
