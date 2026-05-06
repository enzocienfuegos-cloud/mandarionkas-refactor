import React from 'react';
import { recommendationsByMode } from '../reporting.mock';
import type { ReportingMode } from '../reporting.types';
import { WidgetPanel } from './WidgetPanel';

const severityTone = {
  info: 'border-[color:var(--dusk-border-subtle)] bg-[color:var(--dusk-surface-muted)] text-[color:var(--dusk-text-secondary)]',
  opportunity: 'border-emerald-400/25 bg-emerald-500/12 text-emerald-700 dark:text-emerald-200',
  warning: 'border-amber-400/25 bg-amber-500/12 text-amber-700 dark:text-amber-200',
  critical: 'border-rose-400/25 bg-rose-500/12 text-rose-700 dark:text-rose-200',
};

export function RecommendationsPanel({ mode }: { mode: ReportingMode }) {
  const rows = recommendationsByMode[mode];
  return (
    <WidgetPanel title="Insights & recommendations" icon="health" tone="slate">
      <div className="space-y-3">
        {rows.map((row) => (
          <div key={row.id} className="rounded-2xl border border-[color:var(--dusk-border-subtle)] bg-[color:var(--dusk-surface-muted)] px-3 py-3">
            <div className="flex items-center justify-between gap-3">
              <p className="font-semibold text-[color:var(--dusk-text-primary)]">{row.title}</p>
              <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold capitalize ${severityTone[row.severity]}`}>{row.severity}</span>
            </div>
            <p className="mt-2 text-sm text-[color:var(--dusk-text-muted)]">{row.body}</p>
            {row.actionLabel ? (
              <a href={row.actionHref ?? '#'} className="mt-3 inline-flex rounded-xl border border-[color:var(--dusk-border-subtle)] bg-surface-1 px-3 py-2 text-xs font-bold text-[color:var(--dusk-text-primary)] transition hover:bg-surface-hover">
                {row.actionLabel}
              </a>
            ) : null}
          </div>
        ))}
      </div>
    </WidgetPanel>
  );
}
