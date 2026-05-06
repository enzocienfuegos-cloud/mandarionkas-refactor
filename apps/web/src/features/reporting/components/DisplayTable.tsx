import React from 'react';
import type { CampaignPerformanceRow } from '../reporting.types';
import { WidgetPanel } from './WidgetPanel';

function statusClass(status: CampaignPerformanceRow['status']) {
  if (status === 'active') return 'border-emerald-400/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-200';
  if (status === 'limited') return 'border-amber-400/30 bg-amber-500/15 text-amber-700 dark:text-amber-200';
  if (status === 'paused') return 'border-[color:var(--dusk-border-default)] bg-[color:var(--dusk-surface-muted)] text-[color:var(--dusk-text-secondary)]';
  return 'border-violet-400/30 bg-violet-500/15 text-violet-700 dark:text-violet-200';
}

function fmtNum(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
}

export function DisplayTable({ title, rows, icon = 'campaign' }: { title: string; rows: CampaignPerformanceRow[]; icon?: 'campaign' | 'tag' | 'creative' }) {
  return (
    <WidgetPanel title={title} icon={icon} tone="fuchsia">
      <div className="overflow-hidden rounded-2xl border border-[color:var(--dusk-border-subtle)]">
        <table className="min-w-full divide-y divide-[color:var(--dusk-border-subtle)] text-sm">
          <thead className="bg-[color:var(--dusk-surface-muted)]">
            <tr className="text-left text-[11px] font-bold uppercase tracking-[0.22em] text-[color:var(--dusk-text-soft)]">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Impressions</th>
              <th className="px-4 py-3">Clicks</th>
              <th className="px-4 py-3">CTR</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[color:var(--dusk-border-subtle)]">
            {rows.map((row) => (
              <tr key={row.id} className="bg-transparent hover:bg-surface-hover">
                <td className="px-4 py-3 font-semibold text-[color:var(--dusk-text-primary)]">{row.name}</td>
                <td className="px-4 py-3"><span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold capitalize ${statusClass(row.status)}`}>{row.status}</span></td>
                <td className="px-4 py-3 text-[color:var(--dusk-text-secondary)]">{fmtNum(row.impressions)}</td>
                <td className="px-4 py-3 text-[color:var(--dusk-text-secondary)]">{fmtNum(row.clicks)}</td>
                <td className="px-4 py-3 text-[color:var(--dusk-text-secondary)]">{row.ctr.toFixed(2)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </WidgetPanel>
  );
}
