import React from 'react';
import { cn } from '../cn';

export type BadgeTone =
  | 'success'
  | 'warning'
  | 'critical'
  | 'info'
  | 'neutral'
  | 'brand';

export type BadgeSize = 'sm' | 'md';
export type BadgeVariant = 'soft' | 'solid' | 'outline';

const toneClasses: Record<BadgeVariant, Record<BadgeTone, string>> = {
  soft: {
    success:  'bg-[color:var(--dusk-status-success-bg)]  text-[color:var(--dusk-status-success-fg)]  border border-[color:var(--dusk-status-success-border)]',
    warning:  'bg-[color:var(--dusk-status-warning-bg)]  text-[color:var(--dusk-status-warning-fg)]  border border-[color:var(--dusk-status-warning-border)]',
    critical: 'bg-[color:var(--dusk-status-critical-bg)] text-[color:var(--dusk-status-critical-fg)] border border-[color:var(--dusk-status-critical-border)]',
    info:     'bg-[color:var(--dusk-status-info-bg)]     text-[color:var(--dusk-status-info-fg)]     border border-[color:var(--dusk-status-info-border)]',
    neutral:  'bg-[color:var(--dusk-status-neutral-bg)]  text-[color:var(--dusk-status-neutral-fg)]  border border-[color:var(--dusk-status-neutral-border)]',
    brand:    'bg-brand-500/10 text-text-brand border border-brand-500/30',
  },
  solid: {
    success:  'bg-[color:var(--dusk-status-success-fg)]  text-white',
    warning:  'bg-[color:var(--dusk-status-warning-fg)]  text-white',
    critical: 'bg-[color:var(--dusk-status-critical-fg)] text-white',
    info:     'bg-[color:var(--dusk-status-info-fg)]     text-white',
    neutral:  'bg-[color:var(--dusk-text-secondary)]      text-white',
    brand:    'bg-brand-500 text-white',
  },
  outline: {
    success:  'border border-[color:var(--dusk-status-success-border)] text-[color:var(--dusk-status-success-fg)]',
    warning:  'border border-[color:var(--dusk-status-warning-border)] text-[color:var(--dusk-status-warning-fg)]',
    critical: 'border border-[color:var(--dusk-status-critical-border)] text-[color:var(--dusk-status-critical-fg)]',
    info:     'border border-[color:var(--dusk-status-info-border)] text-[color:var(--dusk-status-info-fg)]',
    neutral:  'border border-[color:var(--dusk-border-default)] text-[color:var(--dusk-text-muted)]',
    brand:    'border border-brand-500/30 text-text-brand',
  },
};

const sizeClasses: Record<BadgeSize, string> = {
  sm: 'h-5 px-2 text-[11px]',
  md: 'h-6 px-2.5 text-xs',
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  variant?: BadgeVariant;
  size?: BadgeSize;
  /** Optional dot indicator on the left */
  dot?: boolean;
  leadingIcon?: React.ReactNode;
}

/**
 * Status badge / pill. Use semantic tones, never raw colors.
 *
 * @example
 *   <Badge tone="success">Live</Badge>
 *   <Badge tone="warning" dot>Limited</Badge>
 *   <Badge tone="critical" variant="solid">12 issues</Badge>
 */
export function Badge({
  tone = 'neutral',
  variant = 'soft',
  size = 'md',
  dot = false,
  leadingIcon,
  className,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-medium whitespace-nowrap',
        sizeClasses[size],
        toneClasses[variant][tone],
        className,
      )}
      {...props}
    >
      {dot && <DotIndicator tone={tone} />}
      {leadingIcon && <span className="[&>svg]:h-3 [&>svg]:w-3">{leadingIcon}</span>}
      {children}
    </span>
  );
}

function DotIndicator({ tone }: { tone: BadgeTone }) {
  const colorMap: Record<BadgeTone, string> = {
    success:  'bg-[color:var(--dusk-status-success-fg)]',
    warning:  'bg-[color:var(--dusk-status-warning-fg)]',
    critical: 'bg-[color:var(--dusk-status-critical-fg)]',
    info:     'bg-[color:var(--dusk-status-info-fg)]',
    neutral:  'bg-[color:var(--dusk-text-soft)]',
    brand:    'bg-brand-500',
  };

  return (
    <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', colorMap[tone])} aria-hidden />
  );
}

/**
 * Kicker — small uppercase label used above headings or as a section eyebrow.
 *
 * @example
 *   <Kicker>Operations</Kicker>
 */
export function Kicker({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn('dusk-kicker', className)} {...props}>
      {children}
    </p>
  );
}
