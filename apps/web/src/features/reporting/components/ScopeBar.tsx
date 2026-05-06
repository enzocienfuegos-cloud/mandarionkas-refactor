import React from 'react';
import type { ReportingMode } from '../reporting.types';
import { IconGlyph } from '../icons/IconGlyph';

const toneClasses: Record<ReportingMode, string> = {
  all: 'border-fuchsia-400/25 bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-200',
  display: 'border-fuchsia-400/25 bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-200',
  video: 'border-blue-400/25 bg-blue-500/10 text-blue-700 dark:text-blue-200',
  identity: 'border-emerald-400/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200',
};

export function ScopeBar({ mode }: { mode: ReportingMode }) {
  return (
    <div className="flex flex-col gap-3 rounded-[18px] border border-[color:var(--dusk-border-default)] bg-surface-1 p-4 shadow-2 backdrop-blur-xl lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold ${toneClasses[mode]}`}>
          <IconGlyph name="filter" size={12} />
          {mode === 'all' ? 'Unified scope' : `${mode} scope`}
        </span>
        <span className="rounded-full border border-[color:var(--dusk-border-subtle)] bg-[color:var(--dusk-surface-muted)] px-3 py-1 text-xs font-semibold text-[color:var(--dusk-text-secondary)]">Workspace: Signalmix</span>
        <span className="rounded-full border border-[color:var(--dusk-border-subtle)] bg-[color:var(--dusk-surface-muted)] px-3 py-1 text-xs font-semibold text-[color:var(--dusk-text-secondary)]">Date range: 30 days</span>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs text-[color:var(--dusk-text-muted)]">
        <span className="inline-flex items-center gap-1 rounded-full border border-[color:var(--dusk-border-subtle)] bg-[color:var(--dusk-surface-muted)] px-3 py-1">
          <IconGlyph name="calendar" size={12} />
          Updated 6 min ago
        </span>
        <button type="button" className="inline-flex items-center gap-1 rounded-full border border-[color:var(--dusk-border-subtle)] bg-[color:var(--dusk-surface-muted)] px-3 py-1 font-semibold text-[color:var(--dusk-text-secondary)] transition hover:bg-surface-hover hover:text-[color:var(--dusk-text-primary)]">
          <IconGlyph name="share" size={12} />
          Share
        </button>
      </div>
    </div>
  );
}
