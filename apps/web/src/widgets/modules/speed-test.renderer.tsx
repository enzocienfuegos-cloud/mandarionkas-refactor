import { useEffect, useMemo, useState } from 'react';
import type { WidgetNode } from '../../domain/document/types';
import type { RenderContext } from '../../canvas/stage/render-context';
import { clamp, getAccent, moduleBody, moduleHeader, moduleShell, renderCollapsedIfNeeded } from './shared-styles';

function buildSpeedTestTarget(min: number, max: number, fixedValue: number, mode: string): number {
  if (mode === 'fixed') return clamp(fixedValue, min, max);
  const span = Math.max(1, max - min);
  return clamp(Math.round(min + Math.random() * span), min, max);
}

function SpeedTestModuleRenderer({ node, ctx }: { node: WidgetNode; ctx: RenderContext }): JSX.Element {
  const accent = getAccent(node);
  const min = Number(node.props.min ?? 10);
  const max = Number(node.props.max ?? 100);
  const fixedValue = Number(node.props.current ?? 64);
  const durationMs = Math.max(300, Number(node.props.durationMs ?? 1800));
  const units = String(node.props.units ?? 'Mbps');
  const ctaLabel = String(node.props.ctaLabel ?? 'Start test');
  const resultMode = String(node.props.resultMode ?? 'random');
  const [current, setCurrent] = useState(clamp(fixedValue, min, max));
  const [isTesting, setIsTesting] = useState(false);
  const pct = clamp((current / Math.max(1, max)) * 100, 0, 100);

  useEffect(() => {
    setCurrent(clamp(fixedValue, min, max));
    setIsTesting(false);
  }, [fixedValue, min, max, resultMode]);

  const buttonLabel = useMemo(() => (isTesting ? 'Testing…' : ctaLabel), [ctaLabel, isTesting]);

  const runTest = () => {
    if (isTesting) return;
    const target = buildSpeedTestTarget(min, max, fixedValue, resultMode);
    const startedAt = performance.now();
    setIsTesting(true);

    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      const nextValue = Math.round(min + (target - min) * eased);
      setCurrent(clamp(nextValue, min, max));
      if (progress < 1) {
        requestAnimationFrame(tick);
        return;
      }
      setCurrent(clamp(target, min, max));
      setIsTesting(false);
      ctx.triggerWidgetAction('click');
    };

    setCurrent(min);
    requestAnimationFrame(tick);
  };

  return (
    <div style={moduleShell(node, ctx)}>
      <div style={moduleHeader(node)}>{String(node.props.title ?? node.name)}</div>
      <div style={moduleBody}>
        <div style={{ fontSize: 26, fontWeight: 900 }}>
          {current}
          <span style={{ fontSize: 13, opacity: 0.8 }}> {units}</span>
        </div>
        <div style={{ height: 12, borderRadius: 999, background: 'rgba(255,255,255,0.12)', overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: accent }} />
        </div>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            runTest();
          }}
          style={{ marginTop: 'auto', padding: '10px 12px', borderRadius: 12, background: accent, color: '#111827', fontWeight: 800, border: 'none', cursor: 'pointer' }}
        >
          {buttonLabel}
        </button>
      </div>
    </div>
  );
}

export function renderSpeedTestStage(node: WidgetNode, ctx: RenderContext): JSX.Element {
  const collapsed = renderCollapsedIfNeeded(node, ctx);
  if (collapsed) return collapsed;
  return <SpeedTestModuleRenderer node={node} ctx={ctx} />;
}
