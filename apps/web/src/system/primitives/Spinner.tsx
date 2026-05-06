import React from 'react';
import { cn } from '../cn';

export interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  /** Accessible label, default 'Loading' */
  'aria-label'?: string;
}

const sizeClasses = {
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-10 w-10',
};

/**
 * Loading spinner. Single, consistent visual across the app.
 */
export function Spinner({ size = 'md', className, 'aria-label': ariaLabel = 'Loading' }: SpinnerProps) {
  return (
    <svg
      className={cn('animate-spin text-brand-500', sizeClasses[size], className)}
      viewBox="0 0 24 24"
      fill="none"
      role="status"
      aria-label={ariaLabel}
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.20" />
      <path
        d="M22 12a10 10 0 0 1-10 10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Centered full-area spinner. Use for page-level loading states.
 */
export function CenteredSpinner({ label }: { label?: string }) {
  return (
    <div className="flex h-64 flex-col items-center justify-center gap-3">
      <Spinner size="lg" />
      {label && <p className="text-sm text-[color:var(--dusk-text-muted)]">{label}</p>}
    </div>
  );
}
