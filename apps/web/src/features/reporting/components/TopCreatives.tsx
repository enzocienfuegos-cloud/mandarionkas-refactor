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
          <div key={row.name} className="rounded-2xl border border-[color:var(--dusk-border-subtle)] bg-[color:var(--dusk-surface-muted)] px-3 py-3">
            <div className="flex items-center justify-between gap-3">
              <p className="font-semibold text-[color:var(--dusk-text-primary)]">{row.name}</p>
              <span className="rounded-full border border-[color:var(--dusk-border-subtle)] px-2 py-0.5 text-xs font-bold text-[color:var(--dusk-text-secondary)]">{row.format}</span>
            </div>
            <p className="mt-2 text-sm font-semibold text-[color:var(--dusk-text-primary)]">{row.metric}</p>
            <p className="mt-1 text-xs text-[color:var(--dusk-text-soft)]">{row.helper}</p>
          </div>
        ))}
      </div>
    </WidgetPanel>
  );
}
