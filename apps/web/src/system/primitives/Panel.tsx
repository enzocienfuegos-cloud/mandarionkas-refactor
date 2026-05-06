import React, { forwardRef } from 'react';
import { cn } from '../cn';

export type PanelElevation = 1 | 2 | 3;
export type PanelPadding   = 'none' | 'sm' | 'md' | 'lg';

export interface PanelProps extends React.HTMLAttributes<HTMLElement> {
  /** Visual elevation. Default 2. */
  elevation?: PanelElevation;
  /** Internal padding token. Default 'md'. */
  padding?: PanelPadding;
  /** Render as a different HTML tag (default 'section') */
  as?: keyof JSX.IntrinsicElements;
  /** Use glass/blur backdrop (default true) */
  glass?: boolean;
}

const elevationClasses: Record<PanelElevation, string> = {
  1: 'shadow-1',
  2: 'shadow-2',
  3: 'shadow-3',
};

const paddingClasses: Record<PanelPadding, string> = {
  none: 'p-0',
  sm:   'p-4',
  md:   'p-6',
  lg:   'p-8',
};

/**
 * The single surface primitive of the app. Use this for any
 * raised content area: cards, side panels, sections, modals, etc.
 *
 * @example
 *   <Panel padding="md">...</Panel>
 *   <Panel elevation={3} glass={false}>...</Panel>
 */
export const Panel = forwardRef<HTMLElement, PanelProps>(function Panel(
  { elevation = 2, padding = 'md', as: Tag = 'section', glass = true, className, children, ...props },
  ref,
) {
  return React.createElement(
    Tag,
    {
      ref,
      className: cn(
        'rounded-3xl border border-[color:var(--dusk-border-default)]',
        'bg-surface-1',
        glass && 'backdrop-blur-xl',
        elevationClasses[elevation],
        paddingClasses[padding],
        className,
      ),
      ...props,
    },
    children,
  );
});

/**
 * PanelHeader — standard header strip for a Panel.
 */
export function PanelHeader({
  title,
  subtitle,
  actions,
  kicker,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  kicker?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn('flex items-start justify-between gap-4 mb-4', className)}>
      <div className="min-w-0">
        {kicker && <p className="dusk-kicker mb-1.5">{kicker}</p>}
        <h2 className="text-lg font-semibold text-[color:var(--dusk-text-primary)] tracking-tight">
          {title}
        </h2>
        {subtitle && (
          <p className="mt-1 text-sm text-[color:var(--dusk-text-muted)]">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}
