import React from 'react';
import type { ReportingMode, ReportingModeConfig } from '../reporting.types';
import { ChannelSwitcher } from './ChannelSwitcher';

const accentChip: Record<ReportingModeConfig['accent'], string> = {
  fuchsia: 'border-fuchsia-400/25 bg-fuchsia-500/10 text-fuchsia-200',
  violet: 'border-violet-400/25 bg-violet-500/10 text-violet-200',
  blue: 'border-blue-400/25 bg-blue-500/10 text-blue-200',
  cyan: 'border-cyan-400/25 bg-cyan-500/10 text-cyan-200',
  emerald: 'border-emerald-400/25 bg-emerald-500/10 text-emerald-200',
  amber: 'border-amber-400/25 bg-amber-500/10 text-amber-200',
  rose: 'border-rose-400/25 bg-rose-500/10 text-rose-200',
  slate: 'border-white/10 bg-white/[0.045] text-slate-300',
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
        <h1 className="mt-4 text-3xl font-black tracking-tight text-white md:text-5xl">{config.title}</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">{config.subtitle}</p>
      </div>
      <div className="space-y-4">
        <ChannelSwitcher mode={mode} onModeChange={onModeChange} />
        <div className="rounded-[18px] border border-white/[0.075] bg-[linear-gradient(180deg,rgba(255,255,255,.055),rgba(255,255,255,.032))] p-4 shadow-[0_24px_80px_rgba(0,0,0,.23)] backdrop-blur-xl">
          <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-slate-500">Recommended focus</p>
          <p className="mt-3 text-sm font-semibold text-white">Keep channel switches visible and keep data scoped by mode.</p>
          <p className="mt-1 text-sm text-slate-400">This page updates KPI mix, trend lines, widgets, and recommendations by selected reporting mode.</p>
        </div>
      </div>
    </header>
  );
}
