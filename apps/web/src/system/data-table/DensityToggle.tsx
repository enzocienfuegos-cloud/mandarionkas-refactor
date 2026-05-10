import React from 'react';
import { cn } from '../cn';
import { Rows2, Rows3, Table2 } from '../icons';
import type { Density } from './DataTable';

const OPTIONS: Array<{
  value: Density;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
}> = [
  { value: 'compact', label: 'Compact', Icon: Rows3 },
  { value: 'comfortable', label: 'Comfortable', Icon: Rows2 },
  { value: 'spacious', label: 'Spacious', Icon: Table2 },
];

export function DensityToggle({
  value,
  onChange,
  className,
}: {
  value: Density;
  onChange: (value: Density) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'hidden items-center gap-1 rounded-2xl border border-[color:var(--dusk-border-default)] bg-surface-1 p-1 shadow-1 md:inline-flex',
        className,
      )}
      aria-label="Table density"
      role="group"
    >
      {OPTIONS.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-colors',
              active
                ? 'bg-[color:var(--dusk-surface-active)] text-text-brand'
                : 'text-text-muted hover:bg-surface-hover hover:text-text-primary',
            )}
          >
            <option.Icon className="h-3.5 w-3.5" />
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
