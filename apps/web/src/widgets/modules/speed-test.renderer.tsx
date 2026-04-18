import { useEffect, useMemo, useState } from 'react';
import type { WidgetNode } from '../../domain/document/types';
import type { RenderContext } from '../../canvas/stage/render-context';
import { clamp, getAccent, moduleBody, moduleHeader, moduleShell, renderCollapsedIfNeeded } from './shared-styles';

function buildSpeedTestTarget(min: number, max: number, fixedValue: number, mode: string): number {
  if (mode === 'fixed') return clamp(fixedValue, min, max);
  const span = Math.max(1, max - min);
  return clamp(Math.round(min + Math.random() * span), min, max);
}

function resolveSpeedState(current: number, threshold: number): { tone: string; message: string } {
  return current >= threshold
    ? { tone: '#22c55e', message: 'WOW, very fast network' }
    : { tone: '#ef4444', message: 'Slow connection' };
}

function SpeedTestModuleRenderer({ node, ctx }: { node: WidgetNode; ctx: RenderContext }): JSX.Element {
  const accent = getAccent(node);
  const min = Number(node.props.min ?? 10);
  const max = Number(node.props.max ?? 100);
  const fixedValue = Number(node.props.current ?? 64);
  const durationMs = Math.max(300, Number(node.props.durationMs ?? 1800));
  const units = String(node.props.units ?? 'Mbps');
  const skin = String(node.props.skin ?? 'ookla');
  const pingValue = Number(node.props.pingValue ?? 11);
  const uploadValue = Number(node.props.uploadValue ?? 42);
  const ctaLabel = String(node.props.ctaLabel ?? 'Start test');
  const resultMode = String(node.props.resultMode ?? 'random');
  const fastThreshold = Number(node.props.fastThreshold ?? 70);
  const fastMessage = String(node.props.fastMessage ?? 'WOW, very fast network');
  const slowMessage = String(node.props.slowMessage ?? 'Slow connection');
  const [current, setCurrent] = useState(clamp(fixedValue, min, max));
  const [isTesting, setIsTesting] = useState(false);
  const state = resolveSpeedState(current, fastThreshold);
  const pct = clamp((current / Math.max(1, max)) * 100, 0, 100);
  const isOokla = skin === 'ookla';
  const isFast = skin === 'fast';
  const compact = node.frame.width < 240 || node.frame.height < 150;
  const statLabelFont = compact ? 9 : 11;
  const statValueFont = compact ? 13 : 15;
  const gaugeHeight = compact ? 132 : 156;
  const gaugeBorder = compact ? 12 : 16;
  const gaugeNeedleHeight = compact ? 72 : 88;
  const gaugeNumberFont = compact ? 28 : 34;
  const unitsFont = compact ? 11 : 13;
  const topInset = compact ? 14 : 18;
  const sideInset = compact ? 22 : 28;

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
      <div style={{ ...moduleBody, gap: isOokla ? 14 : 10 }}>
        {(isOokla || isFast) ? (
          <>
            <div style={{ display: 'grid', gap: 6 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: compact ? 8 : 10, fontSize: statLabelFont, letterSpacing: '.08em', textTransform: 'uppercase' }}>
                <div style={{ display: 'grid', gap: 2 }}><span style={{ opacity: 0.74 }}>Ping <span style={{ opacity: 0.5 }}>ms</span></span><strong style={{ fontSize: statValueFont, letterSpacing: 'normal' }}>{pingValue}</strong></div>
                <div style={{ display: 'grid', gap: 2 }}><span style={{ opacity: 0.74 }}>Download <span style={{ opacity: 0.5 }}>{units}</span></span><strong style={{ fontSize: statValueFont, letterSpacing: 'normal' }}>{current}</strong></div>
                <div style={{ display: 'grid', gap: 2 }}><span style={{ opacity: 0.74 }}>Upload <span style={{ opacity: 0.5 }}>{units}</span></span><strong style={{ fontSize: statValueFont, letterSpacing: 'normal' }}>{uploadValue}</strong></div>
              </div>
            </div>
            <div style={{ position: 'relative', height: gaugeHeight, borderRadius: 999, background: isFast ? 'radial-gradient(circle at 50% 100%, rgba(34,197,94,.20), rgba(15,23,42,0) 68%)' : 'radial-gradient(circle at 50% 100%, rgba(45,212,191,.28), rgba(15,23,42,0) 68%)' }}>
              <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
                <div style={{ width: '100%', height: '100%', borderRadius: '999px 999px 36px 36px / 100% 100% 18px 18px', border: `${gaugeBorder}px solid ${isFast ? 'rgba(120,255,196,.24)' : 'rgba(255,255,255,.08)'}`, borderBottom: 'none', transform: 'scaleX(.92)' }} />
                <div style={{ position: 'absolute', top: topInset, left: sideInset, right: sideInset, display: 'flex', justifyContent: 'space-between', fontSize: compact ? 8 : 10, fontWeight: 900, opacity: 0.82 }}>
                  <span>0</span><span>5</span><span>10</span><span>20</span><span>30</span><span>50</span><span>75</span><span>100</span>
                </div>
                <div
                  style={{
                    position: 'absolute',
                    left: '50%',
                    bottom: compact ? 16 : 18,
                    width: compact ? 5 : 6,
                    height: gaugeNeedleHeight,
                    borderRadius: 999,
                    background: isTesting ? accent : state.tone,
                    transformOrigin: 'bottom center',
                    transform: `translateX(-50%) rotate(${(-92 + pct * 1.84).toFixed(1)}deg)`,
                    boxShadow: `0 0 16px ${isTesting ? accent : state.tone}`,
                  }}
                />
                <div style={{ position: 'absolute', bottom: 10, width: compact ? 14 : 16, height: compact ? 14 : 16, borderRadius: '50%', background: '#fff' }} />
                <div style={{ position: 'absolute', bottom: 8, display: 'grid', placeItems: 'center', gap: 2 }}>
                  <div style={{ fontSize: gaugeNumberFont, lineHeight: 1, fontWeight: 300 }}>{current.toFixed(2)}</div>
                  <div style={{ fontSize: unitsFont, opacity: 0.82 }}>{units}</div>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <div style={{ fontSize: compact ? 11 : 12, fontWeight: 800, color: state.tone }}>{current >= fastThreshold ? fastMessage : slowMessage}</div>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  runTest();
                }}
                style={{ padding: '9px 14px', borderRadius: 999, background: '#ffffff', color: '#111827', fontWeight: 900, border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}
              >
                {buttonLabel}
              </button>
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 26, fontWeight: 900 }}>
              {current}
              <span style={{ fontSize: 13, opacity: 0.8 }}> {units}</span>
            </div>
            <div style={{ fontSize: 12, fontWeight: 800, color: state.tone }}>
              {current >= fastThreshold ? fastMessage : slowMessage}
            </div>
            <div style={{ height: 12, borderRadius: 999, background: 'rgba(255,255,255,0.12)', overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: isTesting ? accent : state.tone }} />
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
          </>
        )}
      </div>
    </div>
  );
}

export function renderSpeedTestStage(node: WidgetNode, ctx: RenderContext): JSX.Element {
  const collapsed = renderCollapsedIfNeeded(node, ctx);
  if (collapsed) return collapsed;
  return <SpeedTestModuleRenderer node={node} ctx={ctx} />;
}
