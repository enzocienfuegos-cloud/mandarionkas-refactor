import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, DataTable, DensityToggle, IconButton, Kicker, Panel, type ColumnDef, type Density } from '../../system';
import type { CampaignRow, IconProps, TrendDirection } from './types';
import { classNames, statusBadge } from './utils';
import { getDensity } from '../../shared/preferences';

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
      ? 'border-[color:var(--dusk-status-success-border)] bg-[color:var(--dusk-status-success-bg)] text-[color:var(--dusk-status-success-fg)]'
      : direction === 'down'
        ? 'border-[color:var(--dusk-status-critical-border)] bg-[color:var(--dusk-status-critical-bg)] text-[color:var(--dusk-status-critical-fg)]'
        : 'border-border-default bg-[color:var(--dusk-surface-muted)] text-text-muted';
  return <span className={classNames('rounded-full border px-2.5 py-1 text-xs font-semibold', classes)}>{value}</span>;
}

function CampaignStatusCard({ title, value, helper }: { title: string; value: string; helper: string }) {
  return (
    <div className="rounded-2xl border border-border-default bg-surface-1/60 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-text-muted">{title}</p>
      <p className="mt-2 text-2xl font-semibold text-[color:var(--dusk-text-primary)]">{value}</p>
      <p className="mt-1 text-sm text-text-muted">{helper}</p>
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
  const [density, setDensity] = useState<Density>(() => getDensity('campaigns-main') ?? 'comfortable');
  const columns: ColumnDef<CampaignRow>[] = [
    {
      id: 'campaign',
      header: 'Campaign',
      cell: (campaign) => (
        <div>
          <p className="font-semibold text-text-primary">{campaign.campaign}</p>
          <p className="mt-1 text-xs text-text-muted">{campaign.advertiser} · {campaign.flight}</p>
        </div>
      ),
      sortAccessor: (campaign) => campaign.campaign,
    },
    {
      id: 'status',
      header: 'Status',
      cell: (campaign) => (
        <span className={classNames('inline-flex rounded-full border px-3 py-1 text-xs font-semibold', statusBadge(campaign.status))}>
          {campaign.status}
        </span>
      ),
      sortAccessor: (campaign) => campaign.status,
    },
    {
      id: 'pacing',
      header: 'Pacing',
      cell: (campaign) => <span className="font-medium text-text-secondary">{campaign.pacing}</span>,
      sortAccessor: (campaign) => campaign.pacing,
    },
    {
      id: 'spend',
      header: 'Spend',
      align: 'right',
      cell: (campaign) => (
        <span className="tabular-nums text-text-secondary">
          <span className="font-medium">{campaign.spend}</span>
          <span className="text-[color:var(--dusk-text-soft)]"> / {campaign.budget}</span>
        </span>
      ),
      sortAccessor: (campaign) => campaign.spend,
    },
    {
      id: 'tags',
      header: 'Tags',
      cell: (campaign) => campaign.tagHealth,
      sortAccessor: (campaign) => campaign.tagHealth,
    },
    {
      id: 'creatives',
      header: 'Creatives',
      cell: (campaign) => campaign.creativeStatus,
      sortAccessor: (campaign) => campaign.creativeStatus,
    },
    {
      id: 'issues',
      header: 'Issues',
      align: 'right',
      numeric: true,
      cell: (campaign) => (
        <span
          className={classNames(
            'inline-flex rounded-full px-2.5 py-1 text-xs font-semibold',
            campaign.issues > 0
              ? 'bg-[color:var(--dusk-status-warning-bg)] text-[color:var(--dusk-status-warning-fg)]'
              : 'bg-[color:var(--dusk-status-success-bg)] text-[color:var(--dusk-status-success-fg)]',
          )}
        >
          {campaign.issues}
        </span>
      ),
      sortAccessor: (campaign) => campaign.issues,
    },
    {
      id: 'owner',
      header: 'Owner',
      cell: (campaign) => campaign.owner,
      sortAccessor: (campaign) => campaign.owner,
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: (campaign) => (
        <div className="flex items-center gap-2">
          <IconButton
            onClick={() => onEdit(campaign)}
            aria-label={`Edit ${campaign.campaign}`}
            variant="ghost"
            size="sm"
            icon={<MoreIcon className="h-4 w-4" />}
          />
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
      ),
    },
  ];

  return (
    <Panel className="overflow-hidden p-6">
      <div className="flex flex-col gap-4 border-b border-border-default pb-5 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <Kicker>Campaign workspace</Kicker>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-[color:var(--dusk-text-primary)]">Active &amp; setup campaigns</h2>
          <p className="mt-2 text-sm text-text-muted">Operational view for pacing, tag health, creative QA and launch readiness.</p>
        </div>
        <Link to="/campaigns/new">
          <Button variant="primary" size="sm">New campaign</Button>
        </Link>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-4">
        <CampaignStatusCard title="Total" value={String(campaignRows.length)} helper="campaigns in workspace" />
        <CampaignStatusCard title="Live" value={String(liveCampaigns)} helper="eligible to deliver" />
        <CampaignStatusCard title="Needs attention" value={String(blockedOrLimited)} helper="blocked or limited" />
        <CampaignStatusCard title="Draft setup" value={String(draftSetup)} helper="missing setup steps" />
      </div>

      <div className="mt-6">
        <div className="mb-3 flex justify-end">
          <DensityToggle value={density} onChange={setDensity} />
        </div>
        <DataTable
          columns={columns}
          data={campaignRows}
          rowKey={(campaign) => campaign.id}
          density={density}
          densityKey="campaigns-main"
          bordered
        />
      </div>
    </Panel>
  );
}
