import React from 'react';
import type { ReportingMode, Tone, TrendSeries } from '../reporting.types';
import { trendSeriesByMode } from '../reporting.mock';
import { WidgetPanel } from './WidgetPanel';

const strokeByTone: Record<Tone, string> = {
  fuchsia: '#ec4899',
  violet: '#a855f7',
  blue: '#3b82f6',
  cyan: '#22d3ee',
  emerald: '#10b981',
  amber: '#f59e0b',
  rose: '#fb7185',
  slate: '#94a3b8',
};

function seriesValue(point: TrendSeries['points'][number], seriesId: string) {
  if (seriesId === 'display') return point.display ?? 0;
  if (seriesId === 'video') return point.video ?? 0;
  if (seriesId === 'identity') return point.identity ?? 0;
  if (seriesId === 'total') return point.total ?? 0;
  return point.previous ?? 0;
}

export function TrendChart({ mode }: { mode: ReportingMode }) {
  const series = trendSeriesByMode[mode];
  const basePoints = series[0]?.points ?? [];
  const values = series.flatMap((item) => item.points.map((point) => seriesValue(point, item.id)));
  const max = Math.max(...values, 1);
  const width = 780;
  const height = 250;
  const pad = { t: 10, r: 10, b: 28, l: 14 };
  const chartW = width - pad.l - pad.r;
  const chartH = height - pad.t - pad.b;

  return (
    <WidgetPanel title="Performance over time" icon="spark" tone={mode === 'video' ? 'blue' : mode === 'identity' ? 'emerald' : 'fuchsia'}>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {series.map((item) => (
          <span key={item.id} className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: strokeByTone[item.tone], opacity: item.dashed ? 0.7 : 1 }} />
            {item.label}
          </span>
        ))}
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-64 w-full" aria-label="Reporting trend chart">
        {[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
          const y = pad.t + chartH - chartH * fraction;
          return <line key={fraction} x1={pad.l} y1={y} x2={pad.l + chartW} y2={y} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />;
        })}
        {series.map((item) => {
          const points = item.points.map((point, index) => {
            const x = pad.l + (index / Math.max(item.points.length - 1, 1)) * chartW;
            const y = pad.t + chartH - (seriesValue(point, item.id) / max) * chartH;
            return `${x},${y}`;
          });
          return (
            <polyline
              key={item.id}
              points={points.join(' ')}
              fill="none"
              stroke={strokeByTone[item.tone]}
              strokeWidth="3"
              strokeDasharray={item.dashed ? '7 7' : undefined}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          );
        })}
        {basePoints.map((point, index) => {
          const x = pad.l + (index / Math.max(basePoints.length - 1, 1)) * chartW;
          return <text key={point.date} x={x} y={height - 6} textAnchor="middle" fontSize="11" fill="#64748b">{point.date}</text>;
        })}
      </svg>
    </WidgetPanel>
  );
}
