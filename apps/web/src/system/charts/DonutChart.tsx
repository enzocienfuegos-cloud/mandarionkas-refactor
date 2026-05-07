import React, { useId } from 'react';
import { EmptyState } from '../primitives/EmptyState';
import type { MetricTone } from '../primitives/MetricCard';
import { cn } from '../cn';

export interface DonutSegment {
  id: string;
  label: string;
  value: number;
  tone?: MetricTone;
}

export interface DonutChartProps {
  /** Segments to render. Sum is auto-computed. */
  segments: DonutSegment[];
  /** Optional center label (e.g. total). */
  centerLabel?: string;
  /** Optional center sub-label (smaller, below). */
  centerSubLabel?: string;
  /** Show legend on the side. Default true. */
  showLegend?: boolean;
  /** Size in px. Default 160. */
  size?: number;
  /** Stroke width. Default 14. */
  strokeWidth?: number;
  /** Accessible title (SVG <title>). */
  title?: string;
  /** Accessible description (SVG <desc>). */
  description?: string;
  className?: string;
}

const toneMap: Record<MetricTone, string> = {
  brand: 'var(--dusk-brand-500)',
  success: 'var(--dusk-status-success-fg)',
  warning: 'var(--dusk-status-warning-fg)',
  critical: 'var(--dusk-status-critical-fg)',
  info: 'var(--dusk-status-info-fg)',
  neutral: 'var(--dusk-text-muted)',
};

/**
 * Donut chart for distribution-heavy operational summaries such as campaign
 * status mix, discrepancy severity, and pacing health. Only use when the data
 * is an honest share-of-total already available from the current view model.
 */
export function DonutChart({
  segments,
  centerLabel,
  centerSubLabel,
  showLegend = true,
  size = 160,
  strokeWidth = 14,
  title,
  description,
  className,
}: DonutChartProps) {
  const svgId = useId();
  const total = segments.reduce((sum, segment) => sum + Math.max(segment.value, 0), 0);
  const visibleSegments = segments.filter((segment) => segment.value > 0);

  if (total === 0 || visibleSegments.length === 0) {
    return (
      <div className={cn('rounded-2xl border border-border-subtle bg-surface-2 p-4', className)}>
        <EmptyState
          title="No distribution data yet"
          description="This chart will appear once the current scope returns non-zero values."
        />
      </div>
    );
  }

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div
      className={cn(
        'flex flex-col gap-4',
        showLegend ? 'lg:flex-row lg:items-center lg:justify-between' : 'items-center',
        className,
      )}
    >
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          role="img"
          aria-labelledby={title ? `${svgId}-title` : undefined}
          aria-describedby={description ? `${svgId}-desc` : undefined}
        >
          {title ? <title id={`${svgId}-title`}>{title}</title> : null}
          {description ? <desc id={`${svgId}-desc`}>{description}</desc> : null}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--dusk-surface-muted)"
            strokeWidth={strokeWidth}
          />
          {visibleSegments.map((segment) => {
            const pct = segment.value / total;
            const dash = pct * circumference;
            const arc = (
              <circle
                key={segment.id}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={toneMap[segment.tone ?? 'brand']}
                strokeWidth={strokeWidth}
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-offset}
                strokeLinecap="butt"
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
              />
            );
            offset += dash;
            return arc;
          })}
        </svg>
        {(centerLabel || centerSubLabel) && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            {centerLabel ? <span className="dusk-mono text-2xl font-semibold text-text-primary">{centerLabel}</span> : null}
            {centerSubLabel ? <span className="mt-1 text-xs text-text-muted">{centerSubLabel}</span> : null}
          </div>
        )}
      </div>

      {showLegend && (
        <ul className="grid min-w-[220px] gap-2">
          {visibleSegments.map((segment) => {
            const percent = total > 0 ? (segment.value / total) * 100 : 0;
            return (
              <li key={segment.id} className="flex items-center justify-between gap-4 rounded-xl border border-border-subtle bg-surface-2 px-3 py-2">
                <span className="inline-flex min-w-0 items-center gap-2">
                  <span
                    aria-hidden
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: toneMap[segment.tone ?? 'brand'] }}
                  />
                  <span className="truncate text-sm text-text-secondary">{segment.label}</span>
                </span>
                <span className="dusk-mono shrink-0 text-sm font-medium text-text-primary">
                  {segment.value.toLocaleString()} · {percent.toFixed(0)}%
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
