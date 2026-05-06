import React, { forwardRef } from 'react';
import { ChevronDown } from '../icons';
import { cn } from '../cn';

export type SelectSize = 'sm' | 'md' | 'lg';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  selectSize?: SelectSize;
  invalid?: boolean;
  fullWidth?: boolean;
  /** Convenience prop. Either pass <option> children or this options array. */
  options?: SelectOption[];
}

const sizeClasses: Record<SelectSize, string> = {
  sm: 'h-8 text-xs pl-3 pr-8 rounded-md',
  md: 'h-10 text-sm pl-3 pr-9 rounded-lg',
  lg: 'h-12 text-sm pl-4 pr-10 rounded-lg',
};

/**
 * Native <select> styled to match the design system.
 *
 * For more advanced needs (search, multi-select, custom rendering)
 * use a Combobox component (build separately).
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  {
    selectSize = 'md',
    invalid = false,
    fullWidth = true,
    options,
    className,
    children,
    ...props
  },
  ref,
) {
  return (
    <div className={cn('relative', fullWidth && 'w-full')}>
      <select
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(
          'block w-full appearance-none bg-surface-1 text-[color:var(--dusk-text-primary)]',
          'border outline-none cursor-pointer',
          'transition-[border-color,box-shadow] duration-base ease-standard',
          sizeClasses[selectSize],
          invalid
            ? 'border-[color:var(--dusk-status-critical-fg)]'
            : 'border-[color:var(--dusk-border-default)] hover:border-[color:var(--dusk-border-strong)]',
          className,
        )}
        {...props}
      >
        {options
          ? options.map((opt) => (
              <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                {opt.label}
              </option>
            ))
          : children}
      </select>
      <span
        className={cn(
          'pointer-events-none absolute top-1/2 -translate-y-1/2 text-[color:var(--dusk-text-soft)]',
          selectSize === 'sm' ? 'right-2 [&>svg]:h-3.5 [&>svg]:w-3.5' : 'right-3 [&>svg]:h-4 [&>svg]:w-4',
        )}
      >
        <ChevronDown />
      </span>
    </div>
  );
});
