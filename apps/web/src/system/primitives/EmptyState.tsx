import React from 'react';
import { Panel } from './Panel';
import { Kicker } from './Badge';
import { cn } from '../cn';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  kicker?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  /** Use 'inline' for empty inside a Panel. Use 'page' for full-page empty. */
  variant?: 'inline' | 'page';
}

/**
 * Empty state with icon, title, description and optional CTA.
 *
 * @example
 *   <EmptyState
 *     icon={<Inbox />}
 *     kicker="No data"
 *     title="No campaigns yet"
 *     description="Create your first campaign to start trafficking creatives."
 *     action={<Button variant="primary">New campaign</Button>}
 *   />
 */
export function EmptyState({
  icon,
  kicker,
  title,
  description,
  action,
  className,
  variant = 'inline',
}: EmptyStateProps) {
  const content = (
    <div className={cn('flex flex-col items-center justify-center text-center', variant === 'page' ? 'py-20 px-8' : 'py-14 px-6', className)}>
      {icon && (
        <div
          className={cn(
            'mb-4 flex items-center justify-center rounded-2xl border border-[color:var(--dusk-border-default)]',
            'bg-[color:var(--dusk-surface-muted)]',
            'h-14 w-14 [&>svg]:h-6 [&>svg]:w-6 text-[color:var(--dusk-text-muted)]',
          )}
        >
          {icon}
        </div>
      )}
      {kicker && <Kicker className="mb-2">{kicker}</Kicker>}
      <h3 className="text-lg font-semibold text-[color:var(--dusk-text-primary)] tracking-tight">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-sm text-sm text-[color:var(--dusk-text-muted)] leading-snug">
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );

  if (variant === 'page') return content;
  return <Panel padding="none">{content}</Panel>;
}
