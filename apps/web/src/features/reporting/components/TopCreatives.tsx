import React from 'react';
import { topCreativesRows, topVideoCreatives } from '../reporting.mock';
import type { ReportingMode } from '../reporting.types';
import { WidgetPanel } from './WidgetPanel';

export function TopCreatives({ mode }: { mode: ReportingMode }) {
  const rows = mode === 'video' ? topVideoCreatives : topCreativesRows;
  return (
    <WidgetPanel title="Top creatives" icon="creative" tone={mode === 'video' ? 'blue' : 'fuchsia'}>
      <div className="space-y-3">
        {rows.map((row) => (
          <div key={row.name} className="rounded-2xl border border-white/8 bg-white/[0.025] px-3 py-3">
            <div className="flex items-center justify-between gap-3">
              <p className="font-semibold text-white">{row.name}</p>
              <span className="rounded-full border border-white/10 px-2 py-0.5 text-xs font-bold text-slate-300">{row.format}</span>
            </div>
            <p className="mt-2 text-sm font-semibold text-white">{row.metric}</p>
            <p className="mt-1 text-xs text-slate-500">{row.helper}</p>
          </div>
        ))}
      </div>
    </WidgetPanel>
  );
}
