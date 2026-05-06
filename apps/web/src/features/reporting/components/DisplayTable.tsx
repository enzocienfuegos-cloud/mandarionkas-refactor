import React from 'react';
import type { CampaignPerformanceRow } from '../reporting.types';
import { WidgetPanel } from './WidgetPanel';

function statusClass(status: CampaignPerformanceRow['status']) {
  if (status === 'active') return 'border-emerald-400/30 bg-emerald-500/15 text-emerald-200';
  if (status === 'limited') return 'border-amber-400/30 bg-amber-500/15 text-amber-200';
  if (status === 'paused') return 'border-slate-400/20 bg-white/[0.06] text-slate-300';
  return 'border-violet-400/30 bg-violet-500/15 text-violet-200';
}

function fmtNum(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
}

export function DisplayTable({ title, rows, icon = 'campaign' }: { title: string; rows: CampaignPerformanceRow[]; icon?: 'campaign' | 'tag' | 'creative' }) {
  return (
    <WidgetPanel title={title} icon={icon} tone="fuchsia">
      <div className="overflow-hidden rounded-2xl border border-white/8">
        <table className="min-w-full divide-y divide-white/8 text-sm">
          <thead className="bg-white/[0.025]">
            <tr className="text-left text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Impressions</th>
              <th className="px-4 py-3">Clicks</th>
              <th className="px-4 py-3">CTR</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/8">
            {rows.map((row) => (
              <tr key={row.id} className="bg-transparent hover:bg-white/[0.03]">
                <td className="px-4 py-3 font-semibold text-white">{row.name}</td>
                <td className="px-4 py-3"><span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold capitalize ${statusClass(row.status)}`}>{row.status}</span></td>
                <td className="px-4 py-3 text-slate-300">{fmtNum(row.impressions)}</td>
                <td className="px-4 py-3 text-slate-300">{fmtNum(row.clicks)}</td>
                <td className="px-4 py-3 text-slate-300">{row.ctr.toFixed(2)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </WidgetPanel>
  );
}
