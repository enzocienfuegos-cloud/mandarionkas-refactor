import React from 'react';
import type { Tone } from '../reporting.types';
import { IconGlyph } from './IconGlyph';

const toneClasses: Record<Tone, string> = {
  fuchsia: 'border-brand-500/25 bg-[color:var(--dusk-surface-active)] text-text-brand shadow-brand',
  violet: 'border-[color:var(--dusk-status-info-border)] bg-[color:var(--dusk-status-info-bg)] text-[color:var(--dusk-status-info-fg)] shadow-2',
  blue: 'border-[color:var(--dusk-status-info-border)] bg-[color:var(--dusk-status-info-bg)] text-[color:var(--dusk-status-info-fg)] shadow-2',
  cyan: 'border-[color:var(--dusk-status-info-border)] bg-[color:var(--dusk-status-info-bg)] text-[color:var(--dusk-status-info-fg)] shadow-2',
  emerald: 'border-[color:var(--dusk-status-success-border)] bg-[color:var(--dusk-status-success-bg)] text-[color:var(--dusk-status-success-fg)] shadow-2',
  amber: 'border-[color:var(--dusk-status-warning-border)] bg-[color:var(--dusk-status-warning-bg)] text-[color:var(--dusk-status-warning-fg)] shadow-2',
  rose: 'border-[color:var(--dusk-status-critical-border)] bg-[color:var(--dusk-status-critical-bg)] text-[color:var(--dusk-status-critical-fg)] shadow-2',
  slate: 'border-[color:var(--dusk-border-default)] bg-[color:var(--dusk-surface-muted)] text-[color:var(--dusk-text-secondary)]',
};

export function BrandIcon({
  name,
  tone,
  compact = false,
  size = 15,
}: {
  name: Parameters<typeof IconGlyph>[0]['name'];
  tone: Tone;
  compact?: boolean;
  size?: number;
}) {
  return (
    <span
      className={[
        'inline-flex items-center justify-center rounded-2xl border backdrop-blur-sm',
        compact ? 'h-9 w-9 rounded-xl' : 'h-11 w-11',
        toneClasses[tone],
      ].join(' ')}
    >
      <IconGlyph name={name} size={size} />
    </span>
  );
}
