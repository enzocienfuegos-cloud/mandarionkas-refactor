import React from 'react';
import { EmptyState } from '../../../system';
import type { RegionRow } from '../reporting.types';
import { WidgetPanel } from './WidgetPanel';

export function TopRegions({ rows }: { rows: RegionRow[] }) {
  return (
    <WidgetPanel title="Top regions" icon="geo" tone="violet">
      {rows.length ? (
        <div className="space-y-3">
          {rows.map((row) => (
            <div key={row.name} className="flex items-center justify-between rounded-2xl border border-[color:var(--dusk-border-subtle)] bg-[color:var(--dusk-surface-muted)] px-3 py-3">
              <div>
                <p className="font-semibold text-[color:var(--dusk-text-primary)]">{row.name}</p>
                <p className="text-xs text-[color:var(--dusk-text-soft)]">{row.impressions.toLocaleString()} impressions</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-[color:var(--dusk-text-primary)]">{row.metric}</p>
                <p className="text-xs text-[color:var(--dusk-text-soft)]">{row.metricLabel ?? 'Metric'} · {row.share} share</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No regional signal yet"
          description="Regions will populate once the selected reporting scope records delivery by geography."
        />
      )}
    </WidgetPanel>
  );
}
