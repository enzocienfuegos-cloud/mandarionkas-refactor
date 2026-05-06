import React from 'react';
import type { ReportingMode, ReportingModeConfig } from '../reporting.types';
import { ChannelSwitcher } from './ChannelSwitcher';

const accentChip: Record<ReportingModeConfig['accent'], string> = {
  fuchsia: 'border-fuchsia-400/25 bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-200',
  violet: 'border-violet-400/25 bg-violet-500/10 text-violet-600 dark:text-violet-200',
  blue: 'border-blue-400/25 bg-blue-500/10 text-blue-600 dark:text-blue-200',
  cyan: 'border-cyan-400/25 bg-cyan-500/10 text-cyan-700 dark:text-cyan-200',
  emerald: 'border-emerald-400/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200',
  amber: 'border-amber-400/25 bg-amber-500/10 text-amber-700 dark:text-amber-200',
  rose: 'border-rose-400/25 bg-rose-500/10 text-rose-700 dark:text-rose-200',
  slate: 'border-[color:var(--dusk-border-default)] bg-[color:var(--dusk-surface-muted)] text-[color:var(--dusk-text-secondary)]',
};

export function ReportingHeader({
  mode,
  config,
  onModeChange,
}: {
  mode: ReportingMode;
  config: ReportingModeConfig;
  onModeChange: (mode: ReportingMode) => void;
}) {
  return (
    <header className="grid gap-5 xl:grid-cols-[1.4fr_1fr] xl:items-end">
      <div>
        <div className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.24em] ${accentChip[config.accent]}`}>
          Reporting
          <span className="h-1 w-1 rounded-full bg-current opacity-60" />
          {config.label}
        </div>
        <h1 className="mt-4 text-3xl font-black tracking-tight text-[color:var(--dusk-text-primary)] md:text-5xl">{config.title}</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-[color:var(--dusk-text-muted)]">{config.subtitle}</p>
      </div>
      <div className="space-y-4">
        <ChannelSwitcher mode={mode} onModeChange={onModeChange} />
        <div className="rounded-[18px] border border-[color:var(--dusk-border-default)] bg-surface-1 p-4 shadow-2 backdrop-blur-xl">
          <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[color:var(--dusk-text-soft)]">Recommended focus</p>
          <p className="mt-3 text-sm font-semibold text-[color:var(--dusk-text-primary)]">Keep channel switches visible and keep data scoped by mode.</p>
          <p className="mt-1 text-sm text-[color:var(--dusk-text-muted)]">This page updates KPI mix, trend lines, widgets, and recommendations by selected reporting mode.</p>
        </div>
      </div>
    </header>
  );
}
