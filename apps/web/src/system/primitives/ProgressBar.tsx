import React from 'react';
import { cn } from '../cn';

export interface ProgressBarProps {
  /** Value 0-100. */
  value: number;
  /** Optional secondary value 0-100 for "target" indicator. */
  target?: number;
  /** Tone for fill. Default 'brand'. Auto-derives from value if `tone` is 'auto' and `thresholds` provided. */
  tone?: 'brand' | 'success' | 'warning' | 'critical' | 'info' | 'neutral' | 'auto';
  /** When tone='auto': thresholds for color tier. Default: { warn: 60, crit: 40 } (assumes >70 = success). */
  thresholds?: { warn: number; crit: number };
  /** Show numeric label inline. Default true. */
  showLabel?: boolean;
  /** Size. Default 'md'. */
  size?: 'sm' | 'md' | 'lg';
  /** Accessible label for screen readers. */
  'aria-label'?: string;
  /** Format function for displayed value. Default: (v) => `${Math.round(v)}%`. */
  format?: (value: number) => string;
  className?: string;
}

const sizeClasses = {
  sm: 'h-1.5',
  md: 'h-2.5',
  lg: 'h-3',
} as const;

const toneClasses = {
  brand: 'bg-brand-500',
  success: 'bg-[color:var(--dusk-status-success-fg)]',
  warning: 'bg-[color:var(--dusk-status-warning-fg)]',
  critical: 'bg-[color:var(--dusk-status-critical-fg)]',
  info: 'bg-[color:var(--dusk-status-info-fg)]',
  neutral: 'bg-[color:var(--dusk-text-muted)]',
} as const;

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
}

function resolveTone(
  tone: NonNullable<ProgressBarProps['tone']>,
  value: number,
  thresholds: NonNullable<ProgressBarProps['thresholds']>,
) {
  if (tone !== 'auto') return tone;
  if (value >= 80) return 'success';
  if (value >= thresholds.warn) return 'warning';
  if (value < thresholds.crit) return 'critical';
  return 'warning';
}

/**
 * Operational percentage bar for pacing, approval progress and delivery
 * health. Supports a target marker so traffickers can see "where we are"
 * versus "where we should be" at a glance.
 */
export function ProgressBar({
  value,
  target,
  tone = 'brand',
  thresholds = { warn: 60, crit: 40 },
  showLabel = true,
  size = 'md',
  format = (nextValue) => `${Math.round(nextValue)}%`,
  className,
  ...props
}: ProgressBarProps) {
  const safeValue = clampPercent(value);
  const safeTarget = target == null ? null : clampPercent(target);
  const resolvedTone = resolveTone(tone, safeValue, thresholds);

  return (
    <div className={cn('flex min-w-[128px] items-center gap-3', className)}>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(safeValue)}
        className={cn(
          'relative flex-1 overflow-hidden rounded-full bg-surface-muted',
          sizeClasses[size],
        )}
        {...props}
      >
        <div
          className={cn(
            'h-full rounded-full transition-[width] duration-base ease-standard motion-reduce:transition-none',
            toneClasses[resolvedTone],
          )}
          style={{ width: `${safeValue}%` }}
        />
        {safeTarget != null && (
          <span
            aria-hidden
            className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-[color:var(--dusk-text-muted)]"
            style={{ left: `${safeTarget}%` }}
            title={`Target ${format(safeTarget)}`}
          />
        )}
      </div>
      {showLabel && (
        <span className="dusk-mono text-xs font-medium text-[color:var(--dusk-text-primary)]">
          {format(safeValue)}
        </span>
      )}
    </div>
  );
}
