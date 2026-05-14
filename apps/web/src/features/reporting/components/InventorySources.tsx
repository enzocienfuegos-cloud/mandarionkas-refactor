import React from 'react';
import { Badge, EmptyState } from '../../../system';
import type { InventorySourceRow } from '../reporting.types';
import { RankSortToggle, type RankSortDirection } from './RankSortToggle';
import { WidgetPanel } from './WidgetPanel';

type RankMetric = 'impressions' | 'clicks';

export function InventorySources({
  rows,
  kind,
}: {
  rows: InventorySourceRow[];
  kind: InventorySourceRow['kind'];
}) {
  const [sortDirection, setSortDirection] = React.useState<RankSortDirection>('desc');
  const [rankMetric, setRankMetric] = React.useState<RankMetric>('impressions');
  const scopedRows = React.useMemo(() => rows.filter((row) => row.kind === kind), [kind, rows]);
  const sortedRows = React.useMemo(() => (
    [...scopedRows].sort((left, right) => {
      const direction = sortDirection === 'desc' ? 1 : -1;
      return direction * ((right[rankMetric] ?? 0) - (left[rankMetric] ?? 0))
        || left.name.localeCompare(right.name);
    })
  ), [rankMetric, scopedRows, sortDirection]);
  const label = kind === 'App' ? 'apps' : 'sites';

  return (
    <WidgetPanel
      title={kind === 'App' ? 'Top apps' : 'Top sites'}
      icon="geo"
      tone="slate"
      action={scopedRows.length ? (
        <div className="flex items-center gap-2">
          <select
            value={rankMetric}
            onChange={(event) => setRankMetric(event.target.value as RankMetric)}
            className="h-8 rounded-full border border-[color:var(--dusk-border-subtle)] bg-[color:var(--dusk-surface-muted)] px-3 text-xs font-semibold text-[color:var(--dusk-text-secondary)] outline-none"
            aria-label={`Rank ${label} by`}
          >
            <option value="impressions">Top impressions</option>
            <option value="clicks">Top clicks</option>
          </select>
          <RankSortToggle direction={sortDirection} onChange={setSortDirection} />
        </div>
      ) : null}
    >
      {scopedRows.length ? (
        <div className="space-y-3">
          {sortedRows.slice(0, 8).map((row) => {
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
          description={`${kind === 'App' ? 'App' : 'Site'} data will appear once the selected reporting scope records that inventory context.`}
        />
      )}
    </WidgetPanel>
  );
}
