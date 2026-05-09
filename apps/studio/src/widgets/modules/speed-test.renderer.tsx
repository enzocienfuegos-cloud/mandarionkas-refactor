// render-tokenized: brand/theme split enforced by lint-color-literals.mjs
import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import type { WidgetNode } from '../../domain/document/types';
import type { RenderContext } from '../../canvas/stage/render-context';
import { clamp, getAccent, moduleBody, moduleHeader, moduleShell, renderCollapsedIfNeeded } from './shared-styles';
import { SPEED_TEST_DEFAULT_CTA_LABEL, SPEED_TEST_DEFAULT_FAST_MESSAGE, SPEED_TEST_DEFAULT_PROPS, SPEED_TEST_DEFAULT_SLOW_MESSAGE } from './speed-test.shared';

const speedTestBrandPalette = {
  lightSurface: '#fff',
  lightText: '#111827',
  trackSurface: 'rgba(255,255,255,0.12)',
  gaugeFastGlow: 'radial-gradient(circle at 50% 100%, rgba(34,197,94,.20), rgba(15,23,42,0) 68%)',
  gaugeDefaultGlow: 'radial-gradient(circle at 50% 100%, rgba(45,212,191,.28), rgba(15,23,42,0) 68%)',
  gaugeFastBorder: 'rgba(120,255,196,.24)',
  gaugeDefaultBorder: 'rgba(255,255,255,.08)',
  toneFast: '#22c55e',
  toneSlow: '#ef4444',
} as const;

const speedTestStatGridStyle = {
  display: 'grid',
  gap: 6,
} as const;
const speedTestGaugeFrameBaseStyle = {
  position: 'relative',
  borderRadius: 999,
} as const;
const speedTestGaugeCenterStyle = {
  position: 'absolute',
  inset: 0,
  display: 'grid',
  placeItems: 'center',
} as const;
const speedTestGaugeScaleRowBaseStyle = {
  position: 'absolute',
  display: 'flex',
  justifyContent: 'space-between',
  fontWeight: 900,
  opacity: 0.82,
} as const;
const speedTestGaugeHubStyle = {
  position: 'absolute',
  bottom: 10,
  borderRadius: '50%',
  background: speedTestBrandPalette.lightSurface,
} as const;
const speedTestGaugeReadoutStyle = {
  position: 'absolute',
  bottom: 8,
  display: 'grid',
  placeItems: 'center',
  gap: 2,
} as const;
const speedTestSummaryRowStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 10,
} as const;
const speedTestPrimaryButtonBaseStyle = {
  border: 'none',
  cursor: 'pointer',
  fontWeight: 900,
} as const;
const speedTestBarTrackStyle = {
  height: 12,
  borderRadius: 999,
  background: speedTestBrandPalette.trackSurface,
  overflow: 'hidden',
} as const;
const speedTestBarFillBaseStyle = {
  height: '100%',
} as const;
const speedTestSimpleValueStyle = {
  fontSize: 26,
  fontWeight: 900,
} as const;
const speedTestSimpleUnitsStyle = {
  fontSize: 13,
  opacity: 0.8,
} as const;

function buildSpeedTestBodyStyle(isOokla: boolean): CSSProperties {
  return {
    ...moduleBody,
    gap: isOokla ? 14 : 10,
  };
}

function buildSpeedTestStatsRowStyle(compact: boolean, statLabelFont: number): CSSProperties {
  return {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: compact ? 8 : 10,
    fontSize: statLabelFont,
    letterSpacing: '.08em',
    textTransform: 'uppercase',
  };
}

function buildSpeedTestStatCellStyle(): CSSProperties {
  return {
    display: 'grid',
    gap: 2,
  };
}

function buildSpeedTestStatLabelStyle(): CSSProperties {
  return {
    opacity: 0.74,
  };
}

function buildSpeedTestStatUnitsStyle(): CSSProperties {
  return {
    opacity: 0.5,
  };
}

function buildSpeedTestStatValueStyle(statValueFont: number): CSSProperties {
  return {
    fontSize: statValueFont,
    letterSpacing: 'normal',
  };
}

function buildSpeedTestGaugeFrameStyle(gaugeHeight: number, isFast: boolean): CSSProperties {
  return {
    ...speedTestGaugeFrameBaseStyle,
    height: gaugeHeight,
    background: isFast
      ? speedTestBrandPalette.gaugeFastGlow
      : speedTestBrandPalette.gaugeDefaultGlow,
  };
}

function buildSpeedTestGaugeBorderStyle(compact: boolean, gaugeBorder: number, isFast: boolean): CSSProperties {
  return {
    width: '100%',
    height: '100%',
    borderRadius: '999px 999px 36px 36px / 100% 100% 18px 18px',
    border: `${gaugeBorder}px solid ${isFast ? speedTestBrandPalette.gaugeFastBorder : speedTestBrandPalette.gaugeDefaultBorder}`,
    borderBottom: 'none',
    transform: 'scaleX(.92)',
  };
}

function buildSpeedTestGaugeScaleRowStyle(topInset: number, sideInset: number, compact: boolean): CSSProperties {
  return {
    ...speedTestGaugeScaleRowBaseStyle,
    top: topInset,
    left: sideInset,
    right: sideInset,
    fontSize: compact ? 8 : 10,
  };
}

function buildSpeedTestNeedleStyle(compact: boolean, accent: string, stateTone: string, isTesting: boolean, gaugeNeedleHeight: number, pct: number): CSSProperties {
  const tone = isTesting ? accent : stateTone;
  return {
    position: 'absolute',
    left: '50%',
    bottom: compact ? 16 : 18,
    width: compact ? 5 : 6,
    height: gaugeNeedleHeight,
    borderRadius: 999,
    background: tone,
    transformOrigin: 'bottom center',
    transform: `translateX(-50%) rotate(${(-92 + pct * 1.84).toFixed(1)}deg)`,
    boxShadow: `0 0 16px ${tone}`,
  };
}

function buildSpeedTestGaugeHubDotStyle(compact: boolean): CSSProperties {
  return {
    ...speedTestGaugeHubStyle,
    width: compact ? 14 : 16,
    height: compact ? 14 : 16,
  };
}

function buildSpeedTestGaugeValueStyle(gaugeNumberFont: number): CSSProperties {
  return {
    fontSize: gaugeNumberFont,
    lineHeight: 1,
    fontWeight: 300,
  };
}

function buildSpeedTestGaugeUnitsStyle(unitsFont: number): CSSProperties {
  return {
    fontSize: unitsFont,
    opacity: 0.82,
  };
}

function buildSpeedTestStatusStyle(compact: boolean, tone: string): CSSProperties {
  return {
    fontSize: compact ? 11 : 12,
    fontWeight: 800,
    color: tone,
  };
}

function buildSpeedTestLightButtonStyle(): CSSProperties {
  return {
    ...speedTestPrimaryButtonBaseStyle,
    padding: '9px 14px',
    borderRadius: 999,
    background: speedTestBrandPalette.lightSurface,
    color: speedTestBrandPalette.lightText,
    whiteSpace: 'nowrap',
  };
}

function buildSpeedTestBarFillStyle(pct: number, accent: string, tone: string, isTesting: boolean): CSSProperties {
  return {
    ...speedTestBarFillBaseStyle,
    width: `${pct}%`,
    background: isTesting ? accent : tone,
  };
}

function buildSpeedTestAccentButtonStyle(accent: string): CSSProperties {
  return {
    ...speedTestPrimaryButtonBaseStyle,
    marginTop: 'auto',
    padding: '10px 12px',
    borderRadius: 12,
    background: accent,
    color: speedTestBrandPalette.lightText,
    fontWeight: 800,
  };
}

function buildSpeedTestTarget(min: number, max: number, fixedValue: number, mode: string): number {
  if (mode === 'fixed') return clamp(fixedValue, min, max);
  const span = Math.max(1, max - min);
  return clamp(Math.round(min + Math.random() * span), min, max);
}

function resolveSpeedState(current: number, threshold: number): { tone: string; message: string } {
  return current >= threshold
    ? { tone: speedTestBrandPalette.toneFast, message: 'WOW, very fast network' }
    : { tone: speedTestBrandPalette.toneSlow, message: 'Slow connection' };
}

function SpeedTestModuleRenderer({ node, ctx }: { node: WidgetNode; ctx: RenderContext }): JSX.Element {
  const accent = getAccent(node);
  const min = Number(node.props.min ?? SPEED_TEST_DEFAULT_PROPS.min);
  const max = Number(node.props.max ?? SPEED_TEST_DEFAULT_PROPS.max);
  const fixedValue = Number(node.props.current ?? SPEED_TEST_DEFAULT_PROPS.current);
  const durationMs = Math.max(300, Number(node.props.durationMs ?? SPEED_TEST_DEFAULT_PROPS.durationMs));
  const units = String(node.props.units ?? SPEED_TEST_DEFAULT_PROPS.units);
  const skin = String(node.props.skin ?? SPEED_TEST_DEFAULT_PROPS.skin);
  const pingValue = Number(node.props.pingValue ?? SPEED_TEST_DEFAULT_PROPS.pingValue);
  const uploadValue = Number(node.props.uploadValue ?? SPEED_TEST_DEFAULT_PROPS.uploadValue);
  const ctaLabel = String(node.props.ctaLabel ?? SPEED_TEST_DEFAULT_CTA_LABEL);
  const resultMode = String(node.props.resultMode ?? SPEED_TEST_DEFAULT_PROPS.resultMode);
  const fastThreshold = Number(node.props.fastThreshold ?? SPEED_TEST_DEFAULT_PROPS.fastThreshold);
  const fastMessage = String(node.props.fastMessage ?? SPEED_TEST_DEFAULT_FAST_MESSAGE);
  const slowMessage = String(node.props.slowMessage ?? SPEED_TEST_DEFAULT_SLOW_MESSAGE);
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
  const bodyStyle = buildSpeedTestBodyStyle(isOokla);
  const statsRowStyle = buildSpeedTestStatsRowStyle(compact, statLabelFont);
  const gaugeFrameStyle = buildSpeedTestGaugeFrameStyle(gaugeHeight, isFast);
  const gaugeBorderStyle = buildSpeedTestGaugeBorderStyle(compact, gaugeBorder, isFast);
  const gaugeScaleRowStyle = buildSpeedTestGaugeScaleRowStyle(topInset, sideInset, compact);
  const needleStyle = buildSpeedTestNeedleStyle(compact, accent, state.tone, isTesting, gaugeNeedleHeight, pct);
  const gaugeHubDotStyle = buildSpeedTestGaugeHubDotStyle(compact);
  const gaugeValueStyle = buildSpeedTestGaugeValueStyle(gaugeNumberFont);
  const gaugeUnitsStyle = buildSpeedTestGaugeUnitsStyle(unitsFont);
  const statusStyle = buildSpeedTestStatusStyle(compact, state.tone);
  const lightButtonStyle = buildSpeedTestLightButtonStyle();
  const barFillStyle = buildSpeedTestBarFillStyle(pct, accent, state.tone, isTesting);
  const accentButtonStyle = buildSpeedTestAccentButtonStyle(accent);

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
      <div style={bodyStyle}>
        {(isOokla || isFast) ? (
          <>
            <div style={speedTestStatGridStyle}>
              <div style={statsRowStyle}>
                <div style={buildSpeedTestStatCellStyle()}><span style={buildSpeedTestStatLabelStyle()}>Ping <span style={buildSpeedTestStatUnitsStyle()}>ms</span></span><strong style={buildSpeedTestStatValueStyle(statValueFont)}>{pingValue}</strong></div>
                <div style={buildSpeedTestStatCellStyle()}><span style={buildSpeedTestStatLabelStyle()}>Download <span style={buildSpeedTestStatUnitsStyle()}>{units}</span></span><strong style={buildSpeedTestStatValueStyle(statValueFont)}>{current}</strong></div>
                <div style={buildSpeedTestStatCellStyle()}><span style={buildSpeedTestStatLabelStyle()}>Upload <span style={buildSpeedTestStatUnitsStyle()}>{units}</span></span><strong style={buildSpeedTestStatValueStyle(statValueFont)}>{uploadValue}</strong></div>
              </div>
            </div>
            <div style={gaugeFrameStyle}>
              <div style={speedTestGaugeCenterStyle}>
                <div style={gaugeBorderStyle} />
                <div style={gaugeScaleRowStyle}>
                  <span>0</span><span>5</span><span>10</span><span>20</span><span>30</span><span>50</span><span>75</span><span>100</span>
                </div>
                <div style={needleStyle} />
                <div style={gaugeHubDotStyle} />
                <div style={speedTestGaugeReadoutStyle}>
                  <div style={gaugeValueStyle}>{current.toFixed(2)}</div>
                  <div style={gaugeUnitsStyle}>{units}</div>
                </div>
              </div>
            </div>
            <div style={speedTestSummaryRowStyle}>
              <div style={statusStyle}>{current >= fastThreshold ? fastMessage : slowMessage}</div>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  runTest();
                }}
                style={lightButtonStyle}
              >
                {buttonLabel}
              </button>
            </div>
          </>
        ) : (
          <>
            <div style={speedTestSimpleValueStyle}>
              {current}
              <span style={speedTestSimpleUnitsStyle}> {units}</span>
            </div>
            <div style={statusStyle}>
              {current >= fastThreshold ? fastMessage : slowMessage}
            </div>
            <div style={speedTestBarTrackStyle}>
              <div style={barFillStyle} />
            </div>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                runTest();
              }}
              style={accentButtonStyle}
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
