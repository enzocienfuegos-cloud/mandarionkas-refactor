import React, { forwardRef } from 'react';
import { cn } from '../cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize    = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Optional icon rendered before children */
  leadingIcon?: React.ReactNode;
  /** Optional icon rendered after children */
  trailingIcon?: React.ReactNode;
  /** Show loading spinner and disable */
  loading?: boolean;
  /** Stretch to full width of parent */
  fullWidth?: boolean;
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-8 text-xs px-3 gap-1.5 rounded-md',
  md: 'h-10 text-sm px-4 gap-2 rounded-lg',
  lg: 'h-12 text-sm px-5 gap-2 rounded-lg',
};

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-brand-gradient text-white shadow-brand ' +
    'hover:brightness-105 active:brightness-95 ' +
    'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:brightness-100',

  secondary:
    'bg-surface-1 text-[color:var(--dusk-text-primary)] ' +
    'border border-[color:var(--dusk-border-default)] ' +
    'hover:bg-surface-hover hover:border-[color:var(--dusk-border-strong)] ' +
    'active:bg-surface-active ' +
    'disabled:opacity-50 disabled:cursor-not-allowed',

  ghost:
    'bg-transparent text-[color:var(--dusk-text-secondary)] ' +
    'hover:bg-surface-hover hover:text-[color:var(--dusk-text-primary)] ' +
    'active:bg-surface-active ' +
    'disabled:opacity-50 disabled:cursor-not-allowed',

  danger:
    'bg-[color:var(--dusk-status-critical-fg)] text-white ' +
    'hover:brightness-110 active:brightness-95 ' +
    'disabled:opacity-50 disabled:cursor-not-allowed',
};

/**
 * The single button primitive of the app. All buttons MUST use this.
 *
 * @example
 *   <Button variant="primary" leadingIcon={<Plus />}>New campaign</Button>
 *   <Button variant="danger" loading={isDeleting}>Delete</Button>
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'secondary',
    size = 'md',
    leadingIcon,
    trailingIcon,
    loading = false,
    fullWidth = false,
    disabled,
    className,
    children,
    type = 'button',
    ...props
  },
  ref,
) {
  const isDisabled = disabled || loading;

  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex items-center justify-center font-medium whitespace-nowrap',
        'transition-[background-color,border-color,box-shadow,filter] duration-base ease-standard',
        sizeClasses[size],
        variantClasses[variant],
        fullWidth && 'w-full',
        className,
      )}
      {...props}
    >
      {loading && <Spinner />}
      {!loading && leadingIcon && <span className="shrink-0 [&>svg]:h-4 [&>svg]:w-4">{leadingIcon}</span>}
      {children && <span>{children}</span>}
      {!loading && trailingIcon && <span className="shrink-0 [&>svg]:h-4 [&>svg]:w-4">{trailingIcon}</span>}
    </button>
  );
});

function Spinner() {
  return (
    <svg
      className="h-4 w-4 animate-spin shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Icon-only button. Always pass `aria-label` for screen readers.
 */
export const IconButton = forwardRef<
  HTMLButtonElement,
  Omit<ButtonProps, 'leadingIcon' | 'trailingIcon' | 'children'> & {
    icon: React.ReactNode;
    'aria-label': string;
  }
>(function IconButton({ icon, size = 'md', variant = 'ghost', className, ...props }, ref) {
  const sizeMap: Record<ButtonSize, string> = {
    sm: 'h-8 w-8 rounded-md',
    md: 'h-10 w-10 rounded-lg',
    lg: 'h-12 w-12 rounded-lg',
  };

  return (
    <Button
      ref={ref}
      variant={variant}
      size={size}
      className={cn('!px-0 !gap-0', sizeMap[size], className)}
      {...props}
    >
      <span className="[&>svg]:h-4 [&>svg]:w-4">{icon}</span>
    </Button>
  );
});
