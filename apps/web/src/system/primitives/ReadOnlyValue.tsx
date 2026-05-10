import React, { useMemo } from 'react';
import { Copy } from '../icons';
import { cn } from '../cn';
import { IconButton } from './Button';

export interface ReadOnlyValueProps {
  label?: string;
  value: string;
  placeholder?: string;
  className?: string;
  copyable?: boolean;
}

export function ReadOnlyValue({
  label,
  value,
  placeholder = 'Not available',
  className,
  copyable = true,
}: ReadOnlyValueProps) {
  const displayValue = useMemo(() => value || placeholder, [placeholder, value]);

  return (
    <div
      className={cn(
        'rounded-lg border border-[color:var(--dusk-border-default)] bg-[color:var(--dusk-surface-muted)] px-3 py-2.5',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {label ? (
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[color:var(--dusk-text-soft)]">
              {label}
            </p>
          ) : null}
          <p className="mt-1 break-all text-sm text-[color:var(--dusk-text-secondary)]">
            {displayValue}
          </p>
        </div>
        {copyable && value ? (
          <IconButton
            icon={<Copy />}
            aria-label={`Copy ${label ?? 'value'}`}
            size="sm"
            variant="ghost"
            onClick={() => void navigator.clipboard.writeText(value)}
          />
        ) : null}
      </div>
    </div>
  );
}
