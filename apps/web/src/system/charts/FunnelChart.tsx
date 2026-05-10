import React from 'react';
import { EmptyState } from '../primitives/EmptyState';
import type { MetricTone } from '../primitives/MetricCard';
import { cn } from '../cn';

export interface FunnelStage {
  id: string;
  label: string;
  value: number;
  /** Optional explicit format for display. Default: locale string. */
  format?: (value: number) => string;
}

export interface FunnelChartProps {
  /** Stages in cascade order (largest first). */
  stages: FunnelStage[];
  /** Show drop-off % between stages. Default true. */
  showDropoff?: boolean;
  /** Tone for bars. Default 'brand'. */
  tone?: MetricTone;
  /** Title (a11y SVG <title>). */
  title?: string;
  /** Description (a11y SVG <desc>). */
  description?: string;
  className?: string;
}

const toneClasses: Record<MetricTone, string> = {
  brand: 'from-[color:var(--dusk-brand-500)] to-[color:var(--dusk-text-brand)]',
  success: 'from-[color:var(--dusk-status-success-fg)] to-[color:var(--dusk-status-success-fg)]/65',
  warning: 'from-[color:var(--dusk-status-warning-fg)] to-[color:var(--dusk-status-warning-fg)]/65',
  critical: 'from-[color:var(--dusk-status-critical-fg)] to-[color:var(--dusk-status-critical-fg)]/65',
  info: 'from-[color:var(--dusk-status-info-fg)] to-[color:var(--dusk-status-info-fg)]/65',
  neutral: 'from-[color:var(--dusk-text-muted)] to-[color:var(--dusk-text-soft)]',
};

/**
 * Funnel view for delivery cascades where each stage is a real subset of the
 * previous one. Ideal for impressions → measurable → viewable → clicks and
 * similar adserver QA sequences.
 */
export function FunnelChart({
  stages,
  showDropoff = true,
  tone = 'brand',
  title,
  description,
  className,
}: FunnelChartProps) {
  const validStages = stages.filter((stage) => stage.value >= 0);
  const baseValue = validStages[0]?.value ?? 0;

  if (baseValue === 0 || validStages.length === 0) {
    return (
      <div className={cn('rounded-2xl border border-border-subtle bg-surface-2 p-4', className)}>
        <EmptyState
          title="No funnel data yet"
          description="The funnel will render once the current scope returns measurable delivery stages."
        />
      </div>
    );
  }

  return (
    <div
      role="img"
      aria-label={title}
      aria-describedby={description ? `${title ?? 'funnel'}-desc` : undefined}
      className={cn('space-y-3', className)}
    >
      {description ? <span id={`${title ?? 'funnel'}-desc`} className="sr-only">{description}</span> : null}
      {validStages.map((stage, index) => {
        const pct = baseValue > 0 ? (stage.value / baseValue) * 100 : 0;
        const previous = validStages[index - 1];
        const dropoff = previous && previous.value > 0
          ? Math.max(0, ((previous.value - stage.value) / previous.value) * 100)
          : null;
        return (
          <div key={stage.id}>
            <div className="mb-1.5 flex items-center justify-between gap-4">
              <span className="text-sm font-medium text-text-primary">{stage.label}</span>
              <span className="dusk-mono text-sm text-text-secondary">
                {stage.format ? stage.format(stage.value) : stage.value.toLocaleString()}
              </span>
            </div>
            <div className="h-10 overflow-hidden rounded-xl bg-surface-muted">
              <div
                className={cn(
                  'h-full rounded-xl bg-gradient-to-r transition-[width] duration-slow ease-standard motion-reduce:transition-none',
                  toneClasses[tone],
                )}
                style={{ width: `${Math.max(6, pct)}%` }}
              />
            </div>
            {showDropoff && dropoff != null ? (
              <div className="mt-1.5 inline-flex rounded-full border border-border-subtle bg-surface-2 px-2 py-1 text-[11px] text-text-soft">
                ↓ {dropoff.toFixed(0)}% drop-off
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
