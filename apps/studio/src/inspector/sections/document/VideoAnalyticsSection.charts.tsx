import { useState, type CSSProperties } from 'react';

export type SeriesPoint = { bucket: string; count: number };
export type HoverPoint = { bucket: string; count: number };
export type ComparedEvent = { eventName: string; count: number };

const analyticsPalette = {
  baseline: 'rgba(148,163,184,0.18)',
  default: {
    line: 'rgba(99,211,255,0.95)',
    point: 'rgba(245,165,36,0.95)',
    barFrom: 'rgba(245,165,36,0.95)',
    barTo: 'rgba(99,211,255,0.92)',
  },
  error: {
    line: 'rgba(248,113,113,0.95)',
    point: 'rgba(239,68,68,1)',
    barFrom: 'rgba(248,113,113,0.95)',
    barTo: 'rgba(251,146,60,0.92)',
  },
  click: {
    line: 'rgba(245,165,36,0.95)',
    point: 'rgba(250,204,21,1)',
    barFrom: 'rgba(245,165,36,0.95)',
    barTo: 'rgba(250,204,21,0.92)',
  },
  completion: {
    line: 'rgba(74,222,128,0.95)',
    point: 'rgba(34,197,94,1)',
    barFrom: 'rgba(74,222,128,0.95)',
    barTo: 'rgba(99,211,255,0.92)',
  },
  attention: {
    line: 'rgba(167,139,250,0.95)',
    point: 'rgba(139,92,246,1)',
    barFrom: 'rgba(167,139,250,0.95)',
    barTo: 'rgba(99,211,255,0.92)',
  },
} as const;

const analyticsBaselinePathStyle = {
  stroke: analyticsPalette.baseline,
  strokeWidth: '1',
  fill: 'none',
} as const;

export const analyticsMetadataStyle = {
  wordBreak: 'break-word',
} satisfies CSSProperties;

export function formatDate(value?: string): string {
  if (!value) return 'Never';
  return new Date(value).toLocaleString();
}

function formatBucket(value: string, mode: 'hour' | 'day'): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return mode === 'hour'
    ? date.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric' })
    : date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function buildSparklinePath(points: SeriesPoint[], width: number, height: number): string {
  if (points.length === 0) return '';
  const max = Math.max(...points.map((point) => point.count), 1);
  return points.map((point, index) => {
    const x = points.length === 1 ? width / 2 : (index / (points.length - 1)) * width;
    const y = height - (point.count / max) * height;
    return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(' ');
}

export function getEventPalette(eventName?: string): { line: string; point: string; barFrom: string; barTo: string } {
  if (!eventName) return analyticsPalette.default;
  if (eventName.includes('error')) return analyticsPalette.error;
  if (eventName.includes('click') || eventName.includes('cta')) return analyticsPalette.click;
  if (eventName.includes('quartile') || eventName.includes('complete') || eventName.includes('play')) return analyticsPalette.completion;
  if (eventName.includes('hover') || eventName.includes('impression')) return analyticsPalette.attention;
  return analyticsPalette.default;
}

export function buildAnalyticsHoverPillStyle(borderColor: string): CSSProperties {
  return { borderColor };
}

export function buildAnalyticsBarGridStyle(columnCount: number): CSSProperties {
  return { '--analytics-column-count': `${columnCount}` } as CSSProperties;
}

export function buildAnalyticsBarStyle(height: number, background: string): CSSProperties {
  return { height: `${height}px`, background };
}

export function buildAnalyticsCompareFillStyle(width: string, background: string): CSSProperties {
  return { width, background };
}

export function pickComparedEvents(topEvents: Array<{ eventName: string; count: number }>, selectedEventName?: string): ComparedEvent[] {
  const preferred = ['video_play', 'vast_impression', 'vast_quartile_25', 'vast_quartile_50', 'vast_quartile_75', 'vast_complete', 'video_click', 'video_cta_click', 'vast_click', 'vast_error'];
  const byName = new Map(topEvents.map((item) => [item.eventName, item]));
  const result: ComparedEvent[] = [];
  if (selectedEventName && byName.has(selectedEventName)) result.push(byName.get(selectedEventName)!);
  preferred.forEach((eventName) => {
    const item = byName.get(eventName);
    if (item && !result.some((entry) => entry.eventName === item.eventName)) result.push(item);
  });
  topEvents.forEach((item) => {
    if (!result.some((entry) => entry.eventName === item.eventName)) result.push(item);
  });
  return result.slice(0, 5);
}

export function MiniSeriesChart({
  title,
  mode,
  points,
  eventName,
}: {
  title: string;
  mode: 'hour' | 'day';
  points: SeriesPoint[];
  eventName?: string;
}): JSX.Element {
  const [hoverPoint, setHoverPoint] = useState<HoverPoint | null>(null);

  if (points.length === 0) {
    return (
      <div className="field-stack">
        <small className="muted">{title}</small>
        <div className="pill">No trend yet</div>
      </div>
    );
  }

  const visiblePoints = mode === 'hour' ? points.slice(-8) : points.slice(-7);
  const max = Math.max(...visiblePoints.map((point) => point.count), 1);
  const total = visiblePoints.reduce((sum, point) => sum + point.count, 0);
  const latest = visiblePoints[visiblePoints.length - 1];
  const path = buildSparklinePath(visiblePoints, 220, 52);
  const palette = getEventPalette(eventName);

  return (
    <div className="field-stack">
      <div className="meta-line analytics-card-header">
        <small className="muted">{title}</small>
        <span className="pill">{total} events</span>
      </div>
      <div className="analytics-card" onMouseLeave={() => setHoverPoint(null)}>
        {hoverPoint ? <div className="pill analytics-hover-pill" style={buildAnalyticsHoverPillStyle(palette.line)}>{formatBucket(hoverPoint.bucket, mode)} · {hoverPoint.count}</div> : null}
        <svg viewBox="0 0 220 60" width="100%" height="60" role="img" aria-label={`${title} trend`}>
          <path d="M 0 52 H 220" {...analyticsBaselinePathStyle} />
          <path d={path} stroke={palette.line} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          {visiblePoints.map((point, index) => {
            const x = visiblePoints.length === 1 ? 110 : (index / (visiblePoints.length - 1)) * 220;
            const y = 52 - (point.count / max) * 52;
            return <circle key={`${mode}-${point.bucket}`} cx={x} cy={y} r="3.5" fill={palette.point} onMouseEnter={() => setHoverPoint(point)} />;
          })}
        </svg>
        <div className="meta-line meta-line--between section-offset-top">
          <span className="pill">Peak {max}</span>
          <span className="pill">Latest {latest.count} · {formatBucket(latest.bucket, mode)}</span>
        </div>
        <div className="analytics-bar-grid" style={buildAnalyticsBarGridStyle(visiblePoints.length)}>
          {visiblePoints.map((point) => (
            <div key={`bar-${mode}-${point.bucket}`} className="analytics-bar-column">
              <div className="analytics-bar" title={`${formatBucket(point.bucket, mode)} · ${point.count}`} onMouseEnter={() => setHoverPoint(point)} style={buildAnalyticsBarStyle(Math.max((point.count / max) * 42, 8), `linear-gradient(180deg, ${palette.barFrom}, ${palette.barTo})`)} />
              <span className="analytics-bar-count">{point.count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
