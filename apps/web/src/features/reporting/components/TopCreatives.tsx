import React from 'react';
import { EmptyState } from '../../../system';
import type { CreativeRow, ReportingMode } from '../reporting.types';
import { RankSortToggle, type RankSortDirection } from './RankSortToggle';
import { WidgetPanel } from './WidgetPanel';

type RankMetric = 'impressions' | 'clicks';

function formatCount(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString();
}

export function TopCreatives({ mode, rows }: { mode: ReportingMode; rows: CreativeRow[] }) {
  const [sortDirection, setSortDirection] = React.useState<RankSortDirection>('desc');
  const [rankMetric, setRankMetric] = React.useState<RankMetric>('impressions');
  const sortedRows = React.useMemo(() => (
    [...rows].sort((left, right) => (
      sortDirection === 'desc'
        ? (right[rankMetric] ?? 0) - (left[rankMetric] ?? 0)
        : (left[rankMetric] ?? 0) - (right[rankMetric] ?? 0)
    ))
  ), [rankMetric, rows, sortDirection]);

  return (
    <WidgetPanel
      title="Top creatives"
      icon="creative"
      tone={mode === 'video' ? 'blue' : 'fuchsia'}
      action={rows.length ? (
        <div className="flex items-center gap-2">
          <select
            value={rankMetric}
            onChange={(event) => setRankMetric(event.target.value as RankMetric)}
            className="h-8 rounded-full border border-[color:var(--dusk-border-subtle)] bg-[color:var(--dusk-surface-muted)] px-3 text-xs font-semibold text-[color:var(--dusk-text-secondary)] outline-none"
            aria-label="Rank creatives by"
          >
            <option value="impressions">Top impressions</option>
            <option value="clicks">Top clicks</option>
          </select>
          <RankSortToggle direction={sortDirection} onChange={setSortDirection} />
        </div>
      ) : null}
    >
      {rows.length ? (
        <div className="space-y-3">
          {sortedRows.slice(0, 6).map((row) => (
            <div key={row.name} className="rounded-2xl border border-[color:var(--dusk-border-subtle)] bg-[color:var(--dusk-surface-muted)] px-3 py-3">
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold text-[color:var(--dusk-text-primary)]">{row.name}</p>
                <span className="rounded-full border border-[color:var(--dusk-border-subtle)] px-2 py-0.5 text-xs font-bold text-[color:var(--dusk-text-secondary)]">{row.format}</span>
              </div>
              <p className="mt-2 text-sm font-semibold text-[color:var(--dusk-text-primary)]">
                {typeof row[rankMetric] === 'number'
                  ? `${formatCount(row[rankMetric] ?? 0)} ${rankMetric}`
                  : row.metric}
              </p>
              <p className="mt-1 text-xs text-[color:var(--dusk-text-soft)]">{row.helper}</p>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No creatives in scope"
          description="Creative details will appear here once the current workspace or advertiser scope has approved assets."
        />
      )}
    </WidgetPanel>
  );
}
