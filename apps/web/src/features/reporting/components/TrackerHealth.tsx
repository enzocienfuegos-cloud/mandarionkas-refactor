import React from 'react';
import { trackerHealthRows } from '../reporting.mock';
import { WidgetPanel } from './WidgetPanel';

const statusTone = {
  healthy: 'border-emerald-400/25 bg-emerald-500/12 text-emerald-700 dark:text-emerald-200',
  warning: 'border-amber-400/25 bg-amber-500/12 text-amber-700 dark:text-amber-200',
  critical: 'border-rose-400/25 bg-rose-500/12 text-rose-700 dark:text-rose-200',
};

export function TrackerHealth() {
  return (
    <WidgetPanel title="Tracker health" icon="tracker" tone="amber">
      <div className="space-y-3">
        {trackerHealthRows.map((row) => (
          <div key={row.tracker} className="rounded-2xl border border-[color:var(--dusk-border-subtle)] bg-[color:var(--dusk-surface-muted)] px-3 py-3">
            <div className="flex items-center justify-between gap-3">
              <p className="font-semibold text-[color:var(--dusk-text-primary)]">{row.tracker}</p>
              <span className={`rounded-full border px-2.5 py-1 text-xs font-bold capitalize ${statusTone[row.status]}`}>{row.status}</span>
            </div>
            <p className="mt-1 text-xs text-[color:var(--dusk-text-soft)]">{row.detail}</p>
          </div>
        ))}
      </div>
    </WidgetPanel>
  );
}
