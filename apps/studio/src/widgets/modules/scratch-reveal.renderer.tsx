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

  const image = new Image();
  image.crossOrigin = 'anonymous';
  image.onload = () => {
    ctx.clearRect(0, 0, width, height);
    ctx.filter = coverBlur > 0 ? `blur(${Math.max(0, coverBlur)}px)` : 'none';
    ctx.drawImage(image, 0, 0, width, height);
    ctx.filter = 'none';
    onReady?.();
  };
  image.onerror = fallback;
  image.src = coverImage;
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

function ScratchRevealModuleRenderer({ node, ctx }: { node: WidgetNode; ctx: RenderContext }): JSX.Element {
  const accent = getAccent(node);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pointerActiveRef = useRef(false);
  const [coverReady, setCoverReady] = useState(false);
  const title = String(node.props.title ?? node.name);
  const coverLabel = String(node.props.coverLabel ?? 'Scratch to reveal');
  const revealLabel = String(node.props.revealLabel ?? '20% off today');
  const beforeImage = String(node.props.beforeImage ?? '');
  const afterImage = String(node.props.afterImage ?? '');
  const coverBlur = Math.max(0, Number(node.props.coverBlur ?? 0));
  const scratchRadius = Math.max(8, Number(node.props.scratchRadius ?? 22));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const width = Math.max(1, Math.round(canvas.clientWidth));
    const height = Math.max(1, Math.round(canvas.clientHeight));
    canvas.width = width;
    canvas.height = height;
    setCoverReady(false);
    paintScratchCover(canvas, beforeImage, coverBlur, accent, () => setCoverReady(true));
  }, [beforeImage, coverBlur, accent, node.frame.width, node.frame.height]);

  const scratchAtEvent = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((event.clientY - rect.top) / rect.height) * canvas.height;
    eraseScratch(canvas, x, y, scratchRadius);
  };

  const revealBackground = useMemo(() => (
    afterImage
      ? undefined
      : `linear-gradient(135deg, ${accent}22, var(--white-a-12))`
  ), [afterImage, accent]);

  return (
    <div style={buildScratchRevealShellStyle(node, ctx, revealBackground ?? 'var(--neutral-slate-900)')}>
      {afterImage ? <img src={afterImage} alt={revealLabel} style={scratchRevealMediaStyle} /> : null}
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
