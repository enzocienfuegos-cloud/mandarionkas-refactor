import React from 'react';
import { cn } from '../cn';

/**
 * Skeleton block. Use to indicate loading state for content shape.
 *
 * @example
 *   <Skeleton className="h-4 w-32" />
 *   <Skeleton className="h-10 w-full rounded-lg" />
 */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden
      className={cn(
        'rounded-md bg-[color:var(--dusk-surface-muted)] animate-pulse',
        className,
      )}
      {...props}
    />
  );
}

/**
 * Predefined skeleton patterns for common cases.
 */
export function MetricCardSkeleton() {
  return (
    <div className="rounded-2xl border border-[color:var(--dusk-border-default)] bg-surface-1 p-5 space-y-3">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-3 w-40" />
    </div>
  );
}

export function TableRowSkeleton({ columns = 6 }: { columns?: number }) {
  return (
    <tr>
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="px-4 py-4">
          <Skeleton className={cn('h-4', i === 0 ? 'w-48' : 'w-20')} />
        </td>
      ))}
    </tr>
  );
}
