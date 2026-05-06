import React from 'react';
import type { Tone } from '../reporting.types';
import { IconGlyph } from './IconGlyph';

const toneClasses: Record<Tone, string> = {
  fuchsia: 'border-fuchsia-400/25 bg-fuchsia-500/12 text-fuchsia-600 shadow-[0_0_28px_rgba(217,70,239,.12)] dark:text-fuchsia-200',
  violet: 'border-violet-400/25 bg-violet-500/12 text-violet-600 shadow-[0_0_28px_rgba(139,92,246,.12)] dark:text-violet-200',
  blue: 'border-blue-400/25 bg-blue-500/12 text-blue-600 shadow-[0_0_28px_rgba(59,130,246,.12)] dark:text-blue-200',
  cyan: 'border-cyan-400/25 bg-cyan-500/12 text-cyan-700 shadow-[0_0_28px_rgba(34,211,238,.12)] dark:text-cyan-200',
  emerald: 'border-emerald-400/25 bg-emerald-500/12 text-emerald-700 shadow-[0_0_28px_rgba(16,185,129,.12)] dark:text-emerald-200',
  amber: 'border-amber-400/25 bg-amber-500/12 text-amber-700 shadow-[0_0_28px_rgba(245,158,11,.12)] dark:text-amber-200',
  rose: 'border-rose-400/25 bg-rose-500/12 text-rose-700 shadow-[0_0_28px_rgba(244,63,94,.12)] dark:text-rose-200',
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
