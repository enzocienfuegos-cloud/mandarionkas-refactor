import React from 'react';
import { EmptyState } from '../../../system';
import type { RegionRow } from '../reporting.types';
import { RankSortToggle, type RankSortDirection } from './RankSortToggle';
import { WidgetPanel } from './WidgetPanel';

export function TopRegions({ rows }: { rows: RegionRow[] }) {
  const [sortDirection, setSortDirection] = React.useState<RankSortDirection>('desc');
  const sortedRows = React.useMemo(() => (
    [...rows].sort((left, right) => (
      sortDirection === 'desc'
        ? right.impressions - left.impressions
        : left.impressions - right.impressions
    ))
  ), [rows, sortDirection]);

  return (
    <WidgetPanel
      title="Top departments / states"
      icon="geo"
      tone="violet"
      action={rows.length ? <RankSortToggle direction={sortDirection} onChange={setSortDirection} /> : null}
    >
      {rows.length ? (
        <div className="space-y-3">
          {sortedRows.map((row) => (
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
          title="No department or state signal yet"
          description="Departments, states, and regions will populate once the selected reporting scope records delivery by geography."
        />
      )}
    </WidgetPanel>
  );
}
