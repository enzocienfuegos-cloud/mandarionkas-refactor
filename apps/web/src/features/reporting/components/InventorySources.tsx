import React from 'react';
import { Badge, EmptyState } from '../../../system';
import type { InventorySourceRow } from '../reporting.types';
import { RankSortToggle, type RankSortDirection } from './RankSortToggle';
import { WidgetPanel } from './WidgetPanel';

export function InventorySources({ rows }: { rows: InventorySourceRow[] }) {
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
      title="Sites & apps"
      icon="geo"
      tone="slate"
      action={rows.length ? <RankSortToggle direction={sortDirection} onChange={setSortDirection} /> : null}
    >
      {rows.length ? (
        <div className="space-y-3">
          {sortedRows.map((row) => {
            const deliveryParts = [
              `${row.impressions.toLocaleString()} impressions`,
              typeof row.clicks === 'number' ? `${row.clicks.toLocaleString()} clicks` : '',
              row.detail ?? '',
            ].filter(Boolean);

            return (
              <div key={`${row.kind}:${row.name}`} className="flex items-center justify-between gap-3 rounded-2xl border border-[color:var(--dusk-border-subtle)] bg-[color:var(--dusk-surface-muted)] px-3 py-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="min-w-0 truncate font-semibold text-[color:var(--dusk-text-primary)]">{row.name}</p>
                    <Badge tone={row.kind === 'App' ? 'info' : 'neutral'} size="sm">{row.kind}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-[color:var(--dusk-text-soft)]">
                    {deliveryParts.join(' · ')}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-bold text-[color:var(--dusk-text-primary)]">{row.metric}</p>
                  <p className="text-xs text-[color:var(--dusk-text-soft)]">{row.metricLabel ?? 'Metric'} · {row.share} share</p>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState
          title="No site or app signal yet"
          description="Domain and app data will appear once the selected reporting scope records inventory context."
        />
      )}
    </WidgetPanel>
  );
}
