import React, { useId, useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  AreaChart,
  BarChart,
  Line,
  Area,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

export type TrendChartKind = 'line' | 'area' | 'bar';
export type TrendTone = 'brand' | 'success' | 'warning' | 'critical' | 'info' | 'neutral';

export interface TrendSeries {
  key: string;
  label: string;
  tone?: TrendTone;
  format?: (value: number) => string;
}

export interface TrendChartProps<TData extends Record<string, unknown>> {
  data: TData[];
  xKey: string;
  series: TrendSeries[];
  kind?: TrendChartKind;
  height?: number;
  xFormat?: (value: unknown) => string;
  hideLegend?: boolean;
  hideYAxis?: boolean;
  hideGrid?: boolean;
}

const TONE_COLORS: Record<TrendTone, { stroke: string; fill: string }> = {
  brand: { stroke: 'var(--dusk-brand-500)', fill: 'var(--dusk-brand-500)' },
  success: { stroke: 'var(--dusk-status-success-fg)', fill: 'var(--dusk-status-success-fg)' },
  warning: { stroke: 'var(--dusk-status-warning-fg)', fill: 'var(--dusk-status-warning-fg)' },
  critical: { stroke: 'var(--dusk-status-critical-fg)', fill: 'var(--dusk-status-critical-fg)' },
  info: { stroke: 'var(--dusk-status-info-fg)', fill: 'var(--dusk-status-info-fg)' },
  neutral: { stroke: 'var(--dusk-text-muted)', fill: 'var(--dusk-text-muted)' },
};

export function TrendChart<TData extends Record<string, unknown>>({
  data,
  xKey,
  series,
  kind = 'area',
  height = 280,
  xFormat,
  hideLegend,
  hideYAxis,
  hideGrid,
}: TrendChartProps<TData>) {
  const baseId = useId();

  const tokens = useMemo(() => {
    if (typeof window === 'undefined') {
      return {
        gridStroke: '#e5e7eb',
        axisStroke: '#9ca3af',
        textColor: '#111827',
        tooltipBg: '#ffffff',
        tooltipBorder: '#e5e7eb',
      };
    }
    const root = window.getComputedStyle(document.documentElement);
    return {
      gridStroke: root.getPropertyValue('--dusk-border-subtle').trim() || '#e5e7eb',
      axisStroke: root.getPropertyValue('--dusk-border-default').trim() || '#9ca3af',
      textColor: root.getPropertyValue('--dusk-text-muted').trim() || '#6b7280',
      tooltipBg: root.getPropertyValue('--dusk-surface-1').trim() || '#ffffff',
      tooltipBorder: root.getPropertyValue('--dusk-border-default').trim() || '#e5e7eb',
    };
  }, []);

  const ChartRoot = kind === 'line' ? LineChart : kind === 'bar' ? BarChart : AreaChart;

  return (
    <div style={{ width: '100%', height }} className="dusk-chart">
      <ResponsiveContainer width="100%" height="100%">
        <ChartRoot data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          {kind === 'area' && (
            <defs>
              {series.map((s) => {
                const tone = TONE_COLORS[s.tone ?? 'brand'];
                const gid = `${baseId}-${s.key}-grad`;
                return (
                  <linearGradient key={gid} id={gid} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={tone.fill} stopOpacity={0.28} />
                    <stop offset="100%" stopColor={tone.fill} stopOpacity={0.02} />
                  </linearGradient>
                );
              })}
            </defs>
          )}

          {!hideGrid && (
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={tokens.gridStroke}
              vertical={false}
            />
          )}

          <XAxis
            dataKey={xKey}
            stroke={tokens.axisStroke}
            tick={{ fill: tokens.textColor, fontSize: 11, fontFamily: 'var(--dusk-font-body)' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={xFormat as ((v: unknown) => string) | undefined}
            minTickGap={32}
          />

          {!hideYAxis && (
            <YAxis
              stroke={tokens.axisStroke}
              tick={{ fill: tokens.textColor, fontSize: 11, fontFamily: 'var(--dusk-font-mono)' }}
              tickLine={false}
              axisLine={false}
              width={48}
              tickFormatter={(v: number) => formatAxis(v)}
            />
          )}

          <Tooltip
            cursor={{ stroke: tokens.axisStroke, strokeDasharray: '3 3', strokeOpacity: 0.5 }}
            content={<DuskTooltip series={series} xFormat={xFormat} />}
          />

          {!hideLegend && series.length > 1 && (
            <Legend
              align="left"
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: 11, color: tokens.textColor, fontFamily: 'var(--dusk-font-body)' }}
            />
          )}

          {series.map((s) => {
            const tone = TONE_COLORS[s.tone ?? 'brand'];
            const gid = `${baseId}-${s.key}-grad`;
            const props = {
              key: s.key,
              dataKey: s.key,
              name: s.label,
              stroke: tone.stroke,
              strokeWidth: 2,
              isAnimationActive: true,
              animationDuration: 320,
            };

            if (kind === 'area') {
              return <Area {...props} type="monotone" fill={`url(#${gid})`} fillOpacity={1} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />;
            }
            if (kind === 'line') {
              return <Line {...props} type="monotone" dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />;
            }
            return <Bar {...props} fill={tone.fill} fillOpacity={0.7} radius={[3, 3, 0, 0]} />;
          })}
        </ChartRoot>
      </ResponsiveContainer>
    </div>
  );
}

interface TooltipEntry {
  value?: number;
  dataKey?: string;
  name?: string;
  color?: string;
}

interface DuskTooltipProps {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: unknown;
  series: TrendSeries[];
  xFormat?: (v: unknown) => string;
}

function DuskTooltip({ active, payload, label, series, xFormat }: DuskTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div
      role="tooltip"
      className="rounded-lg shadow-2 px-3 py-2 text-xs"
      style={{
        background: 'var(--dusk-surface-1)',
        border: '1px solid var(--dusk-border-default)',
        boxShadow: 'var(--dusk-shadow-2)',
        minWidth: 140,
      }}
    >
      <p className="dusk-mono text-[10px] uppercase tracking-kicker text-[color:var(--dusk-text-soft)]">
        {xFormat ? xFormat(label) : String(label ?? '')}
      </p>
      <ul className="mt-1.5 space-y-1">
        {payload.map((entry: TooltipEntry, i: number) => {
          const meta = series.find((s) => s.key === entry.dataKey);
          const value = typeof entry.value === 'number' ? entry.value : 0;
          return (
            <li key={i} className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-1.5 text-[color:var(--dusk-text-secondary)]">
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ background: entry.color }}
                  aria-hidden
                />
                {meta?.label ?? entry.name}
              </span>
              <span className="dusk-mono font-medium tabular text-[color:var(--dusk-text-primary)]">
                {meta?.format ? meta.format(value) : value.toLocaleString()}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function formatAxis(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return value.toString();
}
