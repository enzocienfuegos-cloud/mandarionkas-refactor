// render-tokenized: brand/theme split enforced by lint-color-literals.mjs
import { useEffect, useMemo, useRef, type CSSProperties } from 'react';
import type { WidgetNode } from '../../domain/document/types';
import type { RenderContext } from '../../canvas/stage/render-context';
import { playbackEngine } from '../../hooks/use-playback-engine';
import { renderCollapsedIfNeeded } from './shared-styles';

const timerBarShellStyle: CSSProperties = {
  width: '100%',
  height: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const timerBarTrackBaseStyle: CSSProperties = {
  overflow: 'hidden',
  display: 'flex',
};

function buildTimerBarTrackStyle(
  orientation: 'horizontal' | 'vertical',
  thickness: number,
  trackColor: string,
  borderRadius: number,
): CSSProperties {
  return {
    ...timerBarTrackBaseStyle,
    width: orientation === 'horizontal' ? '100%' : thickness,
    height: orientation === 'horizontal' ? thickness : '100%',
    background: trackColor,
    borderRadius,
  };
}

function buildTimerBarFillBoxStyle(fillStyle: CSSProperties, fillColor: string, borderRadius: number): CSSProperties {
  return {
    ...fillStyle,
    background: fillColor,
    borderRadius,
  };
}

function resolveTimerBarProgress(playheadMs: number, durationMs: number): number {
  return Math.max(0, Math.min(1, 1 - (playheadMs / durationMs)));
}

function buildTimerBarTransform(orientation: 'horizontal' | 'vertical', progress: number): string {
  return orientation === 'horizontal'
    ? `scale3d(${progress}, 1, 1)`
    : `scale3d(1, ${progress}, 1)`;
}

function syncTimerBarProgress(
  fillNode: HTMLDivElement,
  orientation: 'horizontal' | 'vertical',
  playheadMs: number,
  durationMs: number,
): void {
  const nextTransform = buildTimerBarTransform(orientation, resolveTimerBarProgress(playheadMs, durationMs));
  if (fillNode.style.transform !== nextTransform) {
    fillNode.style.transform = nextTransform;
  }
}

function TimerBarRenderer({ node, ctx }: { node: WidgetNode; ctx: RenderContext }) {
  const durationSource = String(node.props.durationSource ?? 'scene');
  const durationMs = Math.max(1000, Number(durationSource === 'custom' ? (node.props.durationMs ?? 7000) : ctx.sceneDurationMs));
  const orientation = String(node.props.orientation ?? 'horizontal') === 'vertical' ? 'vertical' : 'horizontal';
  const fillColor = String(node.props.fillColor ?? 'var(--accent-cyan-bright)');
  const trackColor = String(node.props.trackColor ?? 'var(--white-a-18)');
  const borderRadius = Math.max(0, Number(node.props.borderRadius ?? 4));
  const thickness = Math.max(8, Number(node.props.thickness ?? 8));
  const progress = resolveTimerBarProgress(ctx.playheadMs, durationMs);
  const fillRef = useRef<HTMLDivElement | null>(null);
  const animationRef = useRef<Animation | null>(null);

  useEffect(() => {
    const fillNode = fillRef.current;
    if (!fillNode) return undefined;
    if (ctx.isReproducing) return undefined;

    const syncProgress = (playheadMs: number) => {
      syncTimerBarProgress(fillNode, orientation, playheadMs, durationMs);
    };

    animationRef.current?.cancel();
    animationRef.current = null;
    syncProgress(ctx.playheadMs);
    return playbackEngine.subscribeDom(syncProgress);
  }, [ctx.isReproducing, ctx.playheadMs, durationMs, orientation]);

  useEffect(() => {
    const fillNode = fillRef.current;
    if (!fillNode || !ctx.isReproducing) return undefined;

    animationRef.current?.cancel();
    animationRef.current = null;

    const startPlayheadMs = playbackEngine.getCurrentMs() || ctx.playheadMs;
    const remainingMs = Math.max(0, durationMs - startPlayheadMs);
    syncTimerBarProgress(fillNode, orientation, startPlayheadMs, durationMs);
    if (!remainingMs) return undefined;

    const animation = fillNode.animate(
      [
        { transform: buildTimerBarTransform(orientation, resolveTimerBarProgress(startPlayheadMs, durationMs)) },
        { transform: buildTimerBarTransform(orientation, 0) },
      ],
      {
        duration: remainingMs,
        easing: 'linear',
        fill: 'forwards',
      },
    );
    animationRef.current = animation;
    return () => {
      animation.cancel();
      animationRef.current = null;
    };
  }, [ctx.isReproducing, ctx.playheadMs, durationMs, orientation]);

  const fillStyle = useMemo<CSSProperties>(() => (
    orientation === 'horizontal'
      ? {
          width: '100%',
          height: '100%',
          transform: buildTimerBarTransform(orientation, progress),
          transformOrigin: 'left center',
          willChange: 'transform',
          backfaceVisibility: 'hidden',
          transformStyle: 'preserve-3d',
        }
      : {
          width: '100%',
          height: '100%',
          transform: buildTimerBarTransform(orientation, progress),
          transformOrigin: 'center bottom',
          willChange: 'transform',
          backfaceVisibility: 'hidden',
          transformStyle: 'preserve-3d',
        }
  ), [orientation, progress]);

  return (
    <div style={timerBarShellStyle}>
      <div style={buildTimerBarTrackStyle(orientation, thickness, trackColor, borderRadius)}>
        <div ref={fillRef} style={buildTimerBarFillBoxStyle(fillStyle, fillColor, borderRadius)} />
      </div>
    </div>
  );
}

export function renderTimerBarStage(node: WidgetNode, ctx: RenderContext): JSX.Element {
  const collapsed = renderCollapsedIfNeeded(node, ctx);
  if (collapsed) return collapsed;
  return <TimerBarRenderer node={node} ctx={ctx} />;
}
