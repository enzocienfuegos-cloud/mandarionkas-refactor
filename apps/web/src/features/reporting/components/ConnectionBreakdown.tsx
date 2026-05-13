import React from 'react';
import { Badge, EmptyState } from '../../../system';
import type { ConnectionBreakdownRow } from '../reporting.types';
import { RankSortToggle, type RankSortDirection } from './RankSortToggle';
import { WidgetPanel } from './WidgetPanel';

type RankMetric = 'impressions' | 'share';

function parseShare(share: string) {
  const parsed = Number(String(share).replace('%', ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function ConnectionBreakdown({ rows }: { rows: ConnectionBreakdownRow[] }) {
  const [sortDirection, setSortDirection] = React.useState<RankSortDirection>('desc');
  const [rankMetric, setRankMetric] = React.useState<RankMetric>('impressions');
  const sortedRows = React.useMemo(() => (
    [...rows].sort((left, right) => {
      const leftValue = rankMetric === 'share' ? parseShare(left.share) : left.impressions;
      const rightValue = rankMetric === 'share' ? parseShare(right.share) : right.impressions;
      return sortDirection === 'desc'
        ? rightValue - leftValue || left.name.localeCompare(right.name)
        : leftValue - rightValue || left.name.localeCompare(right.name);
    })
  ), [rankMetric, rows, sortDirection]);

  return (
    <WidgetPanel
      title="Connection"
      icon="tracker"
      tone="emerald"
      action={rows.length ? (
        <div className="flex items-center gap-2">
          <select
            value={rankMetric}
            onChange={(event) => setRankMetric(event.target.value as RankMetric)}
            className="h-8 rounded-full border border-[color:var(--dusk-border-subtle)] bg-[color:var(--dusk-surface-muted)] px-3 text-xs font-semibold text-[color:var(--dusk-text-secondary)] outline-none"
            aria-label="Rank connections by"
          >
            <option value="impressions">Top impressions</option>
            <option value="share">Top share</option>
          </select>
          <RankSortToggle direction={sortDirection} onChange={setSortDirection} />
        </div>
      ) : null}
    >
      {rows.length ? (
        <div className="space-y-3">
          {sortedRows.map((row) => (
            <div key={`${row.kind}:${row.name}`} className="flex items-center justify-between gap-3 rounded-2xl border border-[color:var(--dusk-border-subtle)] bg-[color:var(--dusk-surface-muted)] px-3 py-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="min-w-0 truncate font-semibold text-[color:var(--dusk-text-primary)]">{row.name}</p>
                  <Badge tone={row.kind === 'Connection' ? 'success' : 'neutral'} size="sm">{row.kind}</Badge>
                </div>
                <p className="mt-1 text-xs text-[color:var(--dusk-text-soft)]">
                  {row.impressions.toLocaleString()} impressions
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-bold text-[color:var(--dusk-text-primary)]">{row.share}</p>
                <p className="text-xs text-[color:var(--dusk-text-soft)]">Share of delivery</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No connection signal yet"
          description="Wifi/cellular connection type, effective network class, carrier and network data will appear when the browser or DSP provides those signals."
        />
      )}
    </WidgetPanel>
  );
}
