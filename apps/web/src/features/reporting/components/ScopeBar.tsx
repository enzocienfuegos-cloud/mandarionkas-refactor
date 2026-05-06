import React from 'react';
import type { ReportingMode } from '../reporting.types';
import { IconGlyph } from '../icons/IconGlyph';

const toneClasses: Record<ReportingMode, string> = {
  all: 'border-fuchsia-400/25 bg-fuchsia-500/10 text-fuchsia-200',
  display: 'border-fuchsia-400/25 bg-fuchsia-500/10 text-fuchsia-200',
  video: 'border-blue-400/25 bg-blue-500/10 text-blue-200',
  identity: 'border-emerald-400/25 bg-emerald-500/10 text-emerald-200',
};

export function ScopeBar({ mode }: { mode: ReportingMode }) {
  return (
    <div className="flex flex-col gap-3 rounded-[18px] border border-white/[0.075] bg-[linear-gradient(180deg,rgba(255,255,255,.055),rgba(255,255,255,.032))] p-4 shadow-[0_24px_80px_rgba(0,0,0,.23)] backdrop-blur-xl lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold ${toneClasses[mode]}`}>
          <IconGlyph name="filter" size={12} />
          {mode === 'all' ? 'Unified scope' : `${mode} scope`}
        </span>
        <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs font-semibold text-slate-300">Workspace: Signalmix</span>
        <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs font-semibold text-slate-300">Date range: 30 days</span>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
        <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1">
          <IconGlyph name="calendar" size={12} />
          Updated 6 min ago
        </span>
        <button type="button" className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 font-semibold text-slate-300 transition hover:bg-white/[0.06]">
          <IconGlyph name="share" size={12} />
          Share
        </button>
      </div>
    </div>
  );
}
