import React from 'react';
import { Badge, EmptyState } from '../../../system';
import type { TrackerHealthRow } from '../reporting.types';
import { WidgetPanel } from './WidgetPanel';

const statusTone = {
  healthy: 'success',
  warning: 'warning',
  critical: 'critical',
} as const;

export function TrackerHealth({ rows }: { rows: TrackerHealthRow[] }) {
  return (
    <WidgetPanel title="Tracker health" icon="tracker" tone="amber">
      {rows.length ? (
        <div className="space-y-3">
          {rows.map((row) => (
            <div key={row.tracker} className="rounded-2xl border border-[color:var(--dusk-border-subtle)] bg-[color:var(--dusk-surface-muted)] px-3 py-3">
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold text-[color:var(--dusk-text-primary)]">{row.tracker}</p>
                <Badge tone={statusTone[row.status]} size="sm">{row.status}</Badge>
              </div>
              <p className="mt-1 text-xs text-[color:var(--dusk-text-soft)]">{row.detail}</p>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No tracker diagnostics"
          description="Tracker health will appear here once the selected scope records delivery or engagement signals."
        />
      )}
    </WidgetPanel>
  );
}
