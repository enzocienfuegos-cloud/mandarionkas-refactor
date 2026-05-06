import React from 'react';
import { recommendationsByMode } from '../reporting.mock';
import type { ReportingMode } from '../reporting.types';
import { WidgetPanel } from './WidgetPanel';

const severityTone = {
  info: 'border-white/10 bg-white/[0.04] text-slate-300',
  opportunity: 'border-emerald-400/25 bg-emerald-500/12 text-emerald-200',
  warning: 'border-amber-400/25 bg-amber-500/12 text-amber-200',
  critical: 'border-rose-400/25 bg-rose-500/12 text-rose-200',
};

export function RecommendationsPanel({ mode }: { mode: ReportingMode }) {
  const rows = recommendationsByMode[mode];
  return (
    <WidgetPanel title="Insights & recommendations" icon="health" tone="slate">
      <div className="space-y-3">
        {rows.map((row) => (
          <div key={row.id} className="rounded-2xl border border-white/8 bg-white/[0.025] px-3 py-3">
            <div className="flex items-center justify-between gap-3">
              <p className="font-semibold text-white">{row.title}</p>
              <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold capitalize ${severityTone[row.severity]}`}>{row.severity}</span>
            </div>
            <p className="mt-2 text-sm text-slate-400">{row.body}</p>
            {row.actionLabel ? (
              <a href={row.actionHref ?? '#'} className="mt-3 inline-flex rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-bold text-white transition hover:bg-white/[0.07]">
                {row.actionLabel}
              </a>
            ) : null}
          </div>
        ))}
      </div>
    </WidgetPanel>
  );
}
