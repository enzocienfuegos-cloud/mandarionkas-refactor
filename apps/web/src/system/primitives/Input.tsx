import React, { forwardRef } from 'react';
import { cn } from '../cn';

export type InputSize = 'sm' | 'md' | 'lg';

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  /** Size variant. Default 'md'. */
  inputSize?: InputSize;
  /** Icon shown inside, on the left */
  leadingIcon?: React.ReactNode;
  /** Icon shown inside, on the right */
  trailingIcon?: React.ReactNode;
  /** Show error styling */
  invalid?: boolean;
  /** Stretch full width */
  fullWidth?: boolean;
}

const sizeClasses: Record<InputSize, string> = {
  sm: 'h-8 text-xs px-3 rounded-md',
  md: 'h-10 text-sm px-3 rounded-lg',
  lg: 'h-12 text-sm px-4 rounded-lg',
};

const sizePadLeft: Record<InputSize, string> = {
  sm: 'pl-8',
  md: 'pl-10',
  lg: 'pl-11',
};

const sizePadRight: Record<InputSize, string> = {
  sm: 'pr-8',
  md: 'pr-10',
  lg: 'pr-11',
};

/**
 * Text input primitive. All form inputs in the app use this.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    inputSize = 'md',
    leadingIcon,
    trailingIcon,
    invalid = false,
    fullWidth = true,
    className,
    type = 'text',
    ...props
  },
  ref,
) {
  const inputEl = (
    <input
      ref={ref}
      type={type}
      aria-invalid={invalid || undefined}
      className={cn(
        'block bg-surface-1 text-[color:var(--dusk-text-primary)]',
        'border placeholder:text-[color:var(--dusk-text-soft)]',
        'transition-[border-color,box-shadow] duration-base ease-standard',
        'outline-none',
        sizeClasses[inputSize],
        invalid
          ? 'border-[color:var(--dusk-status-critical-fg)]'
          : 'border-[color:var(--dusk-border-default)] hover:border-[color:var(--dusk-border-strong)]',
        Boolean(leadingIcon) && sizePadLeft[inputSize],
        Boolean(trailingIcon) && sizePadRight[inputSize],
        fullWidth && 'w-full',
        className,
      )}
      {...props}
    />
  );

  if (!leadingIcon && !trailingIcon) return inputEl;

  return (
    <div className={cn('relative', fullWidth && 'w-full')}>
      {leadingIcon && (
        <span
          className={cn(
            'pointer-events-none absolute top-1/2 -translate-y-1/2 text-[color:var(--dusk-text-soft)]',
            inputSize === 'sm' ? 'left-2.5 [&>svg]:h-3.5 [&>svg]:w-3.5' : 'left-3 [&>svg]:h-4 [&>svg]:w-4',
          )}
        >
          {leadingIcon}
        </span>
      )}
      {inputEl}
      {trailingIcon && (
        <span
          className={cn(
            'absolute top-1/2 -translate-y-1/2 text-[color:var(--dusk-text-soft)]',
            inputSize === 'sm' ? 'right-2.5 [&>svg]:h-3.5 [&>svg]:w-3.5' : 'right-3 [&>svg]:h-4 [&>svg]:w-4',
          )}
        >
          {trailingIcon}
        </span>
      )}
    </div>
  );
});

/**
 * FormField — consistent label + helper + error wrapper for inputs/selects/textareas.
 */
export function FormField({
  label,
  required,
  helper,
  error,
  children,
  htmlFor,
  className,
}: {
  label: React.ReactNode;
  required?: boolean;
  helper?: React.ReactNode;
  error?: React.ReactNode;
  children: React.ReactNode;
  htmlFor?: string;
  className?: string;
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label
        htmlFor={htmlFor}
        className="block text-sm font-medium text-[color:var(--dusk-text-secondary)]"
      >
        {label}
        {required && (
          <span className="ml-1 text-[color:var(--dusk-status-critical-fg)]" aria-hidden>
            *
          </span>
        )}
      </label>
      {children}
      {error ? (
        <p className="text-xs text-[color:var(--dusk-status-critical-fg)]" role="alert">
          {error}
        </p>
      ) : helper ? (
        <p className="text-xs text-[color:var(--dusk-text-soft)]">{helper}</p>
      ) : null}
    </div>
  );
}
