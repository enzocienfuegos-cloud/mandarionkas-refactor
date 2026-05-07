import React from 'react';
import { cn } from '../cn';

export interface PageHeaderProps extends React.HTMLAttributes<HTMLElement> {
  /** Required, short. e.g. "Pacing" */
  title: string;
  /** Optional inline metadata, e.g. "127 campaigns · last sync 2 min ago" */
  meta?: React.ReactNode;
  /** Optional kicker above title (small uppercase) */
  kicker?: string;
  /** Primary CTA */
  primaryAction?: React.ReactNode;
  /** Secondary actions */
  secondaryActions?: React.ReactNode;
  /** Compact alert strip below header (rendered only if children passed) */
  alert?: React.ReactNode;
  /** Tone for the alert strip. Default warning. */
  alertTone?: 'info' | 'success' | 'warning' | 'critical' | 'neutral';
}

const alertToneClasses: Record<NonNullable<PageHeaderProps['alertTone']>, string> = {
  info: 'border-[color:var(--dusk-status-info-border)] bg-[color:var(--dusk-status-info-bg)] text-[color:var(--dusk-status-info-fg)]',
  success: 'border-[color:var(--dusk-status-success-border)] bg-[color:var(--dusk-status-success-bg)] text-[color:var(--dusk-status-success-fg)]',
  warning: 'border-[color:var(--dusk-status-warning-border)] bg-[color:var(--dusk-status-warning-bg)] text-[color:var(--dusk-status-warning-fg)]',
  critical: 'border-[color:var(--dusk-status-critical-border)] bg-[color:var(--dusk-status-critical-bg)] text-[color:var(--dusk-status-critical-fg)]',
  neutral: 'border-[color:var(--dusk-border-default)] bg-surface-2 text-text-secondary',
};

/**
 * Compact operational page header for dense workspaces.
 */
export function PageHeader({
  title,
  meta,
  kicker,
  primaryAction,
  secondaryActions,
  alert,
  alertTone = 'warning',
  className,
  ...props
}: PageHeaderProps) {
  return (
    <header className={cn('space-y-4', className)} {...props}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          {kicker ? <p className="dusk-kicker">{kicker}</p> : null}
          <h1 className="mt-1 text-xl font-semibold tracking-tight text-[color:var(--dusk-text-primary)]">
            {title}
          </h1>
          {meta ? (
            <div className="mt-1 text-sm text-[color:var(--dusk-text-muted)]">
              {meta}
            </div>
          ) : null}
        </div>

        {(primaryAction || secondaryActions) ? (
          <div className="flex flex-wrap items-center gap-3 lg:justify-end">
            {secondaryActions}
            {primaryAction}
          </div>
        ) : null}
      </div>

      {alert ? (
        <div className={cn('rounded-2xl border px-4 py-3 shadow-1', alertToneClasses[alertTone])}>
          {alert}
        </div>
      ) : null}
    </header>
  );
}
