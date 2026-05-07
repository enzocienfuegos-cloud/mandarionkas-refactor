import React, { useMemo } from 'react';
import { DataTable, IconButton, type ColumnDef } from '../../system';
import type { PacingCampaign, PacingRow } from './types';
import { GaugeIcon, MoreIcon, PacingStatusPill, SeverityPill } from './components';

export function PacingTable({
  rows,
  campaigns,
  onInspectCampaign,
}: {
  rows: PacingRow[];
  campaigns: PacingCampaign[];
  onInspectCampaign: (campaign: PacingCampaign) => void;
}) {
  const campaignMap = useMemo(
    () => new Map(campaigns.map((campaign) => [campaign.id, campaign])),
    [campaigns],
  );

  const columns = useMemo<ColumnDef<PacingRow>[]>(() => [
    {
      id: 'campaign',
      header: 'Campaign',
      sortAccessor: (row) => row.campaign,
      cell: (row) => (
        <div>
          <p className="font-semibold text-text-primary">{row.campaign}</p>
          <p className="mt-1 text-xs text-text-muted">{row.advertiser}</p>
        </div>
      ),
    },
    {
      id: 'advertiser',
      header: 'Advertiser',
      sortAccessor: (row) => row.advertiser,
      cell: (row) => <span>{row.advertiser}</span>,
    },
    {
      id: 'status',
      header: 'Status',
      sortAccessor: (row) => row.status,
      cell: (row) => <PacingStatusPill status={row.status} />,
    },
    {
      id: 'pacing',
      header: 'Pacing',
      sortAccessor: (row) => Number(row.pacing.replace('%', '')),
      cell: (row) => {
        const pct = Math.min(Number(row.pacing.replace('%', '')) || 0, 100);
        return (
          <div className="flex min-w-[132px] flex-col gap-2">
            <span className="font-medium text-text-primary">{row.pacing}</span>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface-muted">
              <div
                className="h-full rounded-full bg-brand-500"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      },
    },
    {
      id: 'spend',
      header: 'Spend',
      align: 'right',
      numeric: true,
      sortAccessor: (row) => Number(row.spend.replace(/[^0-9.]/g, '')),
      cell: (row) => (
        <span className="font-medium text-text-primary">
          {row.spend}
          <span className="text-text-muted"> / {row.budget}</span>
        </span>
      ),
    },
    {
      id: 'daily-target',
      header: 'Daily target',
      align: 'right',
      numeric: true,
      sortAccessor: (row) => Number(row.dailyTarget.replace(/[^0-9.]/g, '')),
      cell: (row) => row.dailyTarget,
    },
    {
      id: 'projected',
      header: 'Projected',
      align: 'right',
      numeric: true,
      sortAccessor: (row) => Number(row.projected.replace(/[^0-9.]/g, '')),
      cell: (row) => row.projected,
    },
    {
      id: 'risk',
      header: 'Risk',
      sortAccessor: (row) => row.risk,
      cell: (row) => <SeverityPill severity={row.risk} />,
    },
    {
      id: 'owner',
      header: 'Owner',
      sortAccessor: (row) => row.owner,
      cell: (row) => row.owner,
    },
    {
      id: 'actions',
      header: 'Actions',
      align: 'right',
      cell: (row) => {
        const backingCampaign = campaignMap.get(row.id);
        return (
          <div className="flex items-center justify-end gap-1.5">
            <IconButton
              icon={<GaugeIcon className="h-4 w-4" />}
              onClick={(event) => {
                event.stopPropagation();
                if (backingCampaign) onInspectCampaign(backingCampaign);
              }}
              aria-label={`Inspect ${row.campaign}`}
            />
            <IconButton
              icon={<MoreIcon className="h-4 w-4" />}
              onClick={(event) => {
                event.stopPropagation();
                if (backingCampaign) onInspectCampaign(backingCampaign);
              }}
              aria-label={`More actions for ${row.campaign}`}
            />
          </div>
        );
      },
    },
  ], [campaignMap, onInspectCampaign]);

  return (
    <DataTable
      columns={columns}
      data={rows}
      rowKey={(row) => row.id}
      density="comfortable"
      bordered={false}
      emptyState={null}
    />
  );
}
