import { useEffect, useMemo, useState } from 'react';
import type { WidgetNode } from '../../domain/document/types';
import type { RenderContext } from '../../canvas/stage/render-context';
import { renderCollapsedIfNeeded } from './shared-styles';

function TimerBarRenderer({ node, ctx }: { node: WidgetNode; ctx: RenderContext }) {
  const durationSource = String(node.props.durationSource ?? 'scene');
  const durationMs = Math.max(1000, Number(durationSource === 'custom' ? (node.props.durationMs ?? 7000) : ctx.sceneDurationMs));
  const orientation = String(node.props.orientation ?? 'horizontal') === 'vertical' ? 'vertical' : 'horizontal';
  const fillColor = String(node.props.fillColor ?? '#00e5ff');
  const trackColor = String(node.props.trackColor ?? 'rgba(255,255,255,0.2)');
  const borderRadius = Math.max(0, Number(node.props.borderRadius ?? 4));
  const [progress, setProgress] = useState(1);

  useEffect(() => {
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const ratio = Math.max(0, 1 - (now - start) / durationMs);
      setProgress(ratio);
      if (ratio > 0) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [durationMs]);

  const fillStyle = useMemo<React.CSSProperties>(() => (
    orientation === 'horizontal'
      ? { width: `${progress * 100}%`, height: '100%' }
      : { width: '100%', height: `${progress * 100}%`, marginTop: 'auto' }
  ), [orientation, progress]);

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div
        style={{
          width: orientation === 'horizontal' ? '100%' : Math.max(8, Number(node.props.thickness ?? 8)),
          height: orientation === 'horizontal' ? Math.max(8, Number(node.props.thickness ?? 8)) : '100%',
          background: trackColor,
          borderRadius,
          overflow: 'hidden',
          display: 'flex',
        }}
      >
        <div style={{ ...fillStyle, background: fillColor, borderRadius }} />
      </div>
    </div>
  );
}

export function renderTimerBarStage(node: WidgetNode, ctx: RenderContext): JSX.Element {
  const collapsed = renderCollapsedIfNeeded(node, ctx);
  if (collapsed) return collapsed;
  return <TimerBarRenderer node={node} ctx={ctx} />;
}
