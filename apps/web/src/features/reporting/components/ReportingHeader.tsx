import React from 'react';
import type { ReportingMode, ReportingModeConfig } from '../reporting.types';
import { ChannelSwitcher } from './ChannelSwitcher';

const accentChip: Record<ReportingModeConfig['accent'], string> = {
  fuchsia: 'border-brand-500/25 bg-[color:var(--dusk-surface-active)] text-text-brand',
  violet: 'border-[color:var(--dusk-status-info-border)] bg-[color:var(--dusk-status-info-bg)] text-[color:var(--dusk-status-info-fg)]',
  blue: 'border-[color:var(--dusk-status-info-border)] bg-[color:var(--dusk-status-info-bg)] text-[color:var(--dusk-status-info-fg)]',
  cyan: 'border-[color:var(--dusk-status-info-border)] bg-[color:var(--dusk-status-info-bg)] text-[color:var(--dusk-status-info-fg)]',
  emerald: 'border-[color:var(--dusk-status-success-border)] bg-[color:var(--dusk-status-success-bg)] text-[color:var(--dusk-status-success-fg)]',
  amber: 'border-[color:var(--dusk-status-warning-border)] bg-[color:var(--dusk-status-warning-bg)] text-[color:var(--dusk-status-warning-fg)]',
  rose: 'border-[color:var(--dusk-status-critical-border)] bg-[color:var(--dusk-status-critical-bg)] text-[color:var(--dusk-status-critical-fg)]',
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
