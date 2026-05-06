import React from 'react';
import { Link } from 'react-router-dom';
import { Button, Kicker, Panel } from '../../system';
import type { CampaignRow, IconProps, TrendDirection } from './types';
import { classNames, statusBadge } from './utils';

function iconProps(className?: string) {
  return {
    className: classNames('h-5 w-5', className),
    viewBox: '0 0 24 24',
    fill: 'none',
    'aria-hidden': true,
  } as const;
}

export const AlertTriangleIcon = ({ className }: IconProps) => (
  <svg {...iconProps(className)}>
    <path d="M12 4 3.5 19h17L12 4Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    <path d="M12 9v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    <circle cx="12" cy="16" r="1" fill="currentColor" />
  </svg>
);

export const SearchIcon = ({ className }: IconProps) => (
  <svg {...iconProps(className)}>
    <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="1.8" />
    <path d="m21 21-4.3-4.3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

export const FilterIcon = ({ className }: IconProps) => (
  <svg {...iconProps(className)}>
    <path d="M4 6h16M7 12h10M10 18h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

export const GaugeIcon = ({ className }: IconProps) => (
  <svg {...iconProps(className)}>
    <path d="M4 15a8 8 0 1 1 16 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    <path d="m12 15 4-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    <path d="M8 19h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

export const ReportIcon = ({ className }: IconProps) => (
  <svg {...iconProps(className)}>
    <path d="M6 19V9M12 19V5M18 19v-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    <path d="M4 19h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

export const TableIcon = ({ className }: IconProps) => (
  <svg {...iconProps(className)}>
    <rect x="4" y="5" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.8" />
    <path d="M4 10h16M10 5v14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

export const MoreIcon = ({ className }: IconProps) => (
  <svg {...iconProps(className)}>
    <circle cx="5" cy="12" r="1" fill="currentColor" />
    <circle cx="12" cy="12" r="1" fill="currentColor" />
    <circle cx="19" cy="12" r="1" fill="currentColor" />
  </svg>
);

export function TrendBadge({ direction, value }: { direction: TrendDirection; value: string }) {
  const classes =
    direction === 'up'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300'
      : direction === 'down'
        ? 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300'
        : 'border-border-default bg-[color:var(--dusk-surface-muted)] text-text-muted dark:border-white/8 dark:bg-surface-1/[0.03] dark:text-white/58';
  return <span className={classNames('rounded-full border px-2.5 py-1 text-xs font-semibold', classes)}>{value}</span>;
}

function CampaignStatusCard({ title, value, helper }: { title: string; value: string; helper: string }) {
  return (
    <div className="rounded-2xl border border-border-default bg-surface-1/60 p-4 dark:border-white/8 dark:bg-surface-1/[0.025]">
      <p className="text-xs font-medium uppercase tracking-wide text-text-muted dark:text-white/40">{title}</p>
      <p className="mt-2 text-2xl font-semibold text-[color:var(--dusk-text-primary)]">{value}</p>
      <p className="mt-1 text-sm text-text-muted dark:text-white/52">{helper}</p>
    </div>
  );
}

export function CampaignsTable({
  campaignRows,
  liveCampaigns,
  blockedOrLimited,
  draftSetup,
  onEdit,
  onDelete,
  deletingId,
}: {
  campaignRows: CampaignRow[];
  liveCampaigns: number;
  blockedOrLimited: number;
  draftSetup: number;
  onEdit: (row: CampaignRow) => void;
  onDelete: (row: CampaignRow) => void;
  deletingId: string | null;
}) {
  return (
    <Panel className="overflow-hidden p-6">
      <div className="flex flex-col gap-4 border-b border-border-default pb-5 dark:border-white/8 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <Kicker>Campaign workspace</Kicker>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-[color:var(--dusk-text-primary)]">Active &amp; setup campaigns</h2>
          <p className="mt-2 text-sm text-text-muted dark:text-white/56">Operational view for pacing, tag health, creative QA and launch readiness.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="secondary" size="sm">
            <FilterIcon className="h-4 w-4" />
            Filters
          </Button>
          <Link to="/campaigns/new">
            <Button variant="primary" size="sm">New campaign</Button>
          </Link>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-4">
        <CampaignStatusCard title="Total" value={String(campaignRows.length)} helper="campaigns in workspace" />
        <CampaignStatusCard title="Live" value={String(liveCampaigns)} helper="eligible to deliver" />
        <CampaignStatusCard title="Needs attention" value={String(blockedOrLimited)} helper="blocked or limited" />
        <CampaignStatusCard title="Draft setup" value={String(draftSetup)} helper="missing setup steps" />
      </div>

      <div className="app-scrollbar mt-6 overflow-auto rounded-3xl border border-border-default dark:border-white/8">
        <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-white/8">
          <thead className="bg-[color:var(--dusk-surface-muted)]/80 dark:bg-surface-1/[0.02]">
            <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.2em] text-text-muted dark:text-white/42">
              <th className="px-5 py-4">Campaign</th>
              <th className="px-5 py-4">Status</th>
              <th className="px-5 py-4">Pacing</th>
              <th className="px-5 py-4">Spend</th>
              <th className="px-5 py-4">Tags</th>
              <th className="px-5 py-4">Creatives</th>
              <th className="px-5 py-4">Issues</th>
              <th className="px-5 py-4">Owner</th>
              <th className="px-5 py-4" aria-label="Actions" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-white/8">
            {campaignRows.map((campaign) => (
              <tr key={campaign.id} className="bg-surface-1/42 transition hover:bg-fuchsia-50/45 dark:bg-transparent dark:hover:bg-surface-1/[0.04]">
                <td className="px-5 py-5">
                  <p className="font-semibold text-[color:var(--dusk-text-primary)]">{campaign.campaign}</p>
                  <p className="mt-1 text-xs text-text-muted dark:text-white/48">{campaign.advertiser} · {campaign.flight}</p>
                </td>
                <td className="px-5 py-5"><span className={classNames('inline-flex rounded-full border px-3 py-1 text-xs font-semibold', statusBadge(campaign.status))}>{campaign.status}</span></td>
                <td className="px-5 py-5 font-medium text-text-secondary dark:text-white/72">{campaign.pacing}</td>
                <td className="px-5 py-5 tabular-nums text-text-secondary dark:text-white/72"><span className="font-medium">{campaign.spend}</span><span className="text-[color:var(--dusk-text-soft)] dark:text-white/36"> / {campaign.budget}</span></td>
                <td className="px-5 py-5 text-text-muted dark:text-white/62">{campaign.tagHealth}</td>
                <td className="px-5 py-5 text-text-muted dark:text-white/62">{campaign.creativeStatus}</td>
                <td className="px-5 py-5">
                  <span className={classNames('inline-flex rounded-full px-2.5 py-1 text-xs font-semibold', campaign.issues > 0 ? 'bg-amber-100 text-[color:var(--dusk-status-warning-fg)] dark:bg-amber-500/12 dark:text-amber-200' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/12 dark:text-emerald-200')}>
                    {campaign.issues}
                  </span>
                </td>
                <td className="px-5 py-5 text-text-muted dark:text-white/62">{campaign.owner}</td>
                <td className="px-5 py-5">
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      onClick={() => onEdit(campaign)}
                      aria-label={`Edit ${campaign.campaign}`}
                      variant="ghost"
                      size="sm"
                      className="px-2"
                    >
                      <MoreIcon className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      onClick={() => onDelete(campaign)}
                      disabled={deletingId === campaign.id}
                      variant="danger"
                      size="sm"
                    >
                      {deletingId === campaign.id ? 'Deleting…' : 'Delete'}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
