import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

const merger = extendTailwindMerge({
  extend: {
    classGroups: {
      'bg-color': [
        'bg-surface-1',
        'bg-surface-2',
        'bg-surface-muted',
        'bg-surface-hover',
        'bg-surface-active',
        'bg-brand-gradient',
      ],
      'text-color': [
        'text-text-primary',
        'text-text-secondary',
        'text-text-muted',
        'text-text-soft',
        'text-text-brand',
        'text-text-inverse',
      ],
      'border-color': [
        'border-border-subtle',
        'border-border-default',
        'border-border-strong',
      ],
      shadow: [
        'shadow-1',
        'shadow-2',
        'shadow-3',
        'shadow-4',
        'shadow-overlay',
        'shadow-brand',
      ],
    },
  },
});

/**
 * Class-name composer with Tailwind-aware conflict resolution.
 *
 * This keeps consumer overrides reliable for semantic DUSK utilities.
 */
export function cn(...inputs: ClassValue[]): string {
  return merger(clsx(inputs));
}
