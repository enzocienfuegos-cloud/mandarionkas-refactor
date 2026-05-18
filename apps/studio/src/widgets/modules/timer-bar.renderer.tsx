// render-tokenized: brand/theme split enforced by lint-color-literals.mjs
import gsap from 'gsap';
import { CSSPlugin } from 'gsap/CSSPlugin';
import { useEffect, useMemo, useRef, type CSSProperties } from 'react';
import type { WidgetNode } from '../../domain/document/types';
import type { RenderContext } from '../../canvas/stage/render-context';
import { playbackEngine } from '../../hooks/use-playback-engine';
import { renderCollapsedIfNeeded } from './shared-styles';

gsap.registerPlugin(CSSPlugin);

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
  gsap.set(fillNode, {
    transform: nextTransform,
    force3D: true,
  });
}

function TimerBarRenderer({ node, ctx }: { node: WidgetNode; ctx: RenderContext }) {
  const durationSource = String(node.props.durationSource ?? 'scene');
  const durationMs = Math.max(1000, Number(durationSource === 'custom' ? (node.props.durationMs ?? 7000) : ctx.sceneDurationMs));
  const orientation = String(node.props.orientation ?? 'horizontal') === 'vertical' ? 'vertical' : 'horizontal';
  const fillColor = String(node.props.fillColor ?? 'var(--accent-cyan-bright)');
  const trackColor = String(node.props.trackColor ?? 'var(--white-a-18)');
  const borderRadius = Math.max(0, Number(node.props.borderRadius ?? 4));
  const thickness = Math.max(8, Number(node.props.thickness ?? 8));
  const isReproducing = Boolean(ctx.isReproducing);
  const initialPlayheadMs = isReproducing ? playbackEngine.getCurrentMs() : ctx.playheadMs;
  const progress = resolveTimerBarProgress(initialPlayheadMs, durationMs);
  const fillRef = useRef<HTMLDivElement | null>(null);
  const tweenRef = useRef<gsap.core.Tween | null>(null);

  useEffect(() => {
    const fillNode = fillRef.current;
    if (!fillNode) return undefined;
    gsap.set(fillNode, {
      force3D: true,
      willChange: 'transform',
      backfaceVisibility: 'hidden',
      transformStyle: 'preserve-3d',
    });
    return () => {
      tweenRef.current?.kill();
      tweenRef.current = null;
    };
  }, []);

  useEffect(() => {
    const fillNode = fillRef.current;
    if (!fillNode) return undefined;
    if (isReproducing) return undefined;

    const syncProgress = (playheadMs: number) => {
      syncTimerBarProgress(fillNode, orientation, playheadMs, durationMs);
    };

    tweenRef.current?.kill();
    tweenRef.current = null;
    syncProgress(playbackEngine.getCurrentMs());
    return playbackEngine.subscribeDom(syncProgress);
  }, [isReproducing, durationMs, orientation]);

  useEffect(() => {
    const fillNode = fillRef.current;
    if (!fillNode || !isReproducing) return undefined;

    tweenRef.current?.kill();
    tweenRef.current = null;

    const startPlayheadMs = playbackEngine.getCurrentMs();
    const remainingMs = Math.max(0, durationMs - startPlayheadMs);
    syncTimerBarProgress(fillNode, orientation, startPlayheadMs, durationMs);
    if (!remainingMs) return undefined;

    const tween = gsap.to(fillNode, {
      transform: buildTimerBarTransform(orientation, 0),
      duration: remainingMs / 1000,
      ease: 'none',
      overwrite: 'auto',
      force3D: true,
    });
    tweenRef.current = tween;
    return () => {
      tween.kill();
      tweenRef.current = null;
    };
  }, [isReproducing, durationMs, orientation]);

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
