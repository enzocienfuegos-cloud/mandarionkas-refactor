import React from 'react';
import { TrendingUp, TrendingDown } from '../icons';
import { Panel } from './Panel';
import { Kicker } from './Badge';
import { cn } from '../cn';

export type MetricTrend = 'up' | 'down' | 'flat';
export type MetricTone  = 'brand' | 'success' | 'warning' | 'critical' | 'info' | 'neutral';

export interface MetricCardProps {
  label: string;
  value: string | number;
  /** Delta string e.g. '+12%' or '-3.2%' */
  delta?: string;
  trend?: MetricTrend;
  /** Sub-context line below the value */
  context?: string;
  /** Sparkline series. Pass undefined to omit. */
  series?: number[];
  tone?: MetricTone;
  icon?: React.ReactNode;
  /** Click handler turns the whole card into a button */
  onClick?: () => void;
  className?: string;
  loading?: boolean;
}

const toneAccentClass: Record<MetricTone, string> = {
  brand:    'text-text-brand',
  success:  'text-[color:var(--dusk-status-success-fg)]',
  warning:  'text-[color:var(--dusk-status-warning-fg)]',
  critical: 'text-[color:var(--dusk-status-critical-fg)]',
  info:     'text-[color:var(--dusk-status-info-fg)]',
  neutral:  'text-[color:var(--dusk-text-secondary)]',
};

/**
 * Single MetricCard component used by every dashboard.
 *
 * Replaces the 6 duplicate implementations in:
 *   - AdOpsOverview, CampaignList, TagList, CreativeLibrary,
 *     PacingDashboard, DiscrepancyDashboard
 */
export function MetricCard({
  label,
  value,
  delta,
  trend = 'flat',
  context,
  series,
  tone = 'brand',
  icon,
  onClick,
  className,
  loading,
}: MetricCardProps) {
  const isInteractive = Boolean(onClick);
  const Tag = isInteractive ? ('button' as const) : ('div' as const);

  if (loading) {
    return (
      <Panel padding="md" className={className}>
        <div className="space-y-3 animate-pulse">
          <div className="h-3 w-24 rounded bg-[color:var(--dusk-surface-muted)]" />
          <div className="h-8 w-32 rounded bg-[color:var(--dusk-surface-muted)]" />
          <div className="h-3 w-40 rounded bg-[color:var(--dusk-surface-muted)]" />
        </div>
      </Panel>
    );
  }

  return (
    <Panel
      padding="md"
      className={cn(
        'group relative overflow-hidden',
        isInteractive && 'cursor-pointer transition hover:border-[color:var(--dusk-border-strong)] hover:shadow-3 text-left w-full',
        className,
      )}
      as={Tag}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-3">
        <Kicker>{label}</Kicker>
        {icon && <span className={cn('shrink-0 [&>svg]:h-4 [&>svg]:w-4', toneAccentClass[tone])}>{icon}</span>}
      </div>

      <div className="mt-3 flex items-baseline gap-3">
        <span
          className="dusk-metric-value text-3xl font-semibold tracking-tight text-[color:var(--dusk-text-primary)]"
          data-tabular="true"
        >
          {value}
        </span>
        {delta && <DeltaPill trend={trend}>{delta}</DeltaPill>}
      </div>

      {context && (
        <p className="mt-2 text-xs text-[color:var(--dusk-text-muted)] line-clamp-2">{context}</p>
      )}

      {series && series.length > 1 && (
        <Sparkline series={series} tone={tone} className="mt-4" />
      )}
    </Panel>
  );
}

function DeltaPill({ trend, children }: { trend: MetricTrend; children: React.ReactNode }) {
  const map: Record<MetricTrend, string> = {
    up:   'text-[color:var(--dusk-status-success-fg)]',
    down: 'text-[color:var(--dusk-status-critical-fg)]',
    flat: 'text-[color:var(--dusk-text-soft)]',
  };
  const Icon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : null;

  return (
    <span className={cn('inline-flex items-center gap-1 text-xs font-medium', map[trend])}>
      {Icon && <Icon className="h-3 w-3" />}
      {children}
    </span>
  );
}

/**
 * Mini sparkline svg. Stateless, no animation, fits inside a card.
 */
export function Sparkline({
  series,
  tone = 'brand',
  className,
  height = 32,
}: {
  series: number[];
  tone?: MetricTone;
  className?: string;
  height?: number;
}) {
  if (series.length < 2) return null;

  const width = 120;
  const min = Math.min(...series);
  const max = Math.max(...series);
  const span = max - min || 1;

  const points = series.map((value, index) => {
    const x = (index / (series.length - 1)) * width;
    const y = height - ((value - min) / span) * (height - 4) - 2;
    return `${x},${y}`;
  });

  const colorMap: Record<MetricTone, string> = {
    brand:    'var(--dusk-brand-500)',
    success:  'var(--dusk-status-success-fg)',
    warning:  'var(--dusk-status-warning-fg)',
    critical: 'var(--dusk-status-critical-fg)',
    info:     'var(--dusk-status-info-fg)',
    neutral:  'var(--dusk-text-soft)',
  };

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={cn('w-full overflow-visible', className)}
      preserveAspectRatio="none"
      aria-hidden
    >
      <polyline
        points={points.join(' ')}
        fill="none"
        stroke={colorMap[tone]}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
