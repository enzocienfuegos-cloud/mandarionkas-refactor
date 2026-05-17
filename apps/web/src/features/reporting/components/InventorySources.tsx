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
            const metricRows = kind === 'App'
              ? [
                { label: 'Inventory', value: row.inventoryType || 'App' },
                { label: 'Impressions', value: row.impressions.toLocaleString() },
                { label: 'Clicks', value: typeof row.clicks === 'number' ? row.clicks.toLocaleString() : '0' },
                { label: 'Store / platform', value: row.storePlatform || 'Not passed' },
                { label: 'Bundle', value: row.appBundle || row.detail || 'Not passed' },
                { label: 'App ID', value: row.appId || 'Not passed' },
              ]
              : [
                { label: 'Impressions', value: row.impressions.toLocaleString() },
                { label: 'Clicks', value: typeof row.clicks === 'number' ? row.clicks.toLocaleString() : '0' },
              ];

            return (
              <div
                key={`${row.kind}:${row.name}:${row.appBundle ?? row.detail ?? ''}:${row.appId ?? ''}`}
                className="rounded-2xl border border-[color:var(--dusk-border-subtle)] bg-[color:var(--dusk-surface-muted)] px-3 py-3"
              >
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p
                      className="text-sm font-semibold leading-snug text-[color:var(--dusk-text-primary)] [overflow-wrap:anywhere]"
                      title={row.name}
                    >
                      {row.name}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {row.inventoryType ? <Badge tone="neutral" size="sm">{row.inventoryType}</Badge> : null}
                      <Badge tone={row.kind === 'App' ? 'info' : 'neutral'} size="sm">{row.kind}</Badge>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-bold text-[color:var(--dusk-text-primary)]">{row.metric}</p>
                    <p className="text-xs text-[color:var(--dusk-text-soft)]">{row.metricLabel ?? 'Metric'} · {row.share} share</p>
                  </div>
                </div>
                <dl className="mt-3 grid gap-2 sm:grid-cols-2">
                  {metricRows.map((item) => (
                    <div key={item.label} className="min-w-0 rounded-xl border border-[color:var(--dusk-border-subtle)] bg-[color:var(--dusk-surface-card)] px-2.5 py-2">
                      <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--dusk-text-muted)]">{item.label}</dt>
                      <dd className="mt-1 text-xs font-semibold leading-snug text-[color:var(--dusk-text-secondary)] [overflow-wrap:anywhere]" title={item.value}>{item.value}</dd>
                    </div>
                  ))}
                </dl>
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
