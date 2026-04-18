import { useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { WidgetNode } from '../../domain/document/types';
import type { RenderContext } from '../../canvas/stage/render-context';
import { getAccent, moduleBody, moduleHeader, moduleShell, renderCollapsedIfNeeded } from './shared-styles';

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

  const image = new Image();
  image.crossOrigin = 'anonymous';
  image.onload = () => {
    ctx.clearRect(0, 0, width, height);
    ctx.filter = `blur(${Math.max(0, coverBlur)}px)`;
    ctx.drawImage(image, 0, 0, width, height);
    ctx.filter = 'none';
    ctx.fillStyle = 'rgba(17,24,39,0.25)';
    ctx.fillRect(0, 0, width, height);
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
  const coverLabel = String(node.props.coverLabel ?? 'Scratch to reveal');
  const revealLabel = String(node.props.revealLabel ?? '20% off today');
  const beforeImage = String(node.props.beforeImage ?? '');
  const afterImage = String(node.props.afterImage ?? '');
  const coverBlur = Number(node.props.coverBlur ?? 6);
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
      : `linear-gradient(135deg, ${accent}22, rgba(255,255,255,.12))`
  ), [afterImage, accent]);

  return (
    <div style={moduleShell(node, ctx)}>
      <div style={moduleHeader(node)}>{String(node.props.title ?? node.name)}</div>
      <div style={{ ...moduleBody, justifyContent: 'center' }}>
        <div style={{ position: 'relative', flex: 1, borderRadius: 12, overflow: 'hidden', background: revealBackground ?? '#111827' }}>
          {afterImage ? <img src={afterImage} alt={revealLabel} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
          <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 22, textAlign: 'center', padding: 16 }}>{revealLabel}</div>
          <canvas
            ref={canvasRef}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', cursor: 'crosshair', touchAction: 'none', opacity: coverReady ? 1 : 0 }}
            onPointerDown={(event) => {
              event.stopPropagation();
              pointerActiveRef.current = true;
              scratchAtEvent(event);
            }}
            onPointerMove={(event) => {
              if (event.pointerType === 'mouse') {
                scratchAtEvent(event);
                return;
              }
              if (!pointerActiveRef.current) return;
              scratchAtEvent(event);
            }}
            onPointerEnter={(event) => {
              if (event.pointerType === 'mouse') scratchAtEvent(event);
            }}
            onPointerUp={() => {
              pointerActiveRef.current = false;
            }}
            onPointerCancel={() => {
              pointerActiveRef.current = false;
            }}
          />
          <div style={{ position: 'absolute', left: 12, right: 12, bottom: 12, display: 'flex', flexDirection: 'column', gap: 6, pointerEvents: 'none' }}>
            <div style={{ fontSize: 12 }}>{coverLabel}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function renderScratchRevealStage(node: WidgetNode, ctx: RenderContext): JSX.Element {
  const collapsed = renderCollapsedIfNeeded(node, ctx);
  if (collapsed) return collapsed;
  return <ScratchRevealModuleRenderer node={node} ctx={ctx} />;
}
