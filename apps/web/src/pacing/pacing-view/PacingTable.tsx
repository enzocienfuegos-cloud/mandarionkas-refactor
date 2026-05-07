import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar, DataTable, ProgressBar, type ColumnDef, type DropdownMenuEntry } from '../../system';
import type { PacingCampaign, PacingRow } from './types';
import { Eye, Gauge } from '../../system/icons';
import { PacingStatusPill, SeverityPill } from './components';

export function PacingTable({
  rows,
  campaigns,
  onInspectCampaign,
}: {
  rows: PacingRow[];
  campaigns: PacingCampaign[];
  onInspectCampaign: (campaign: PacingCampaign) => void;
}) {
  const navigate = useNavigate();
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
      width: '140px',
      sortAccessor: (row) => row.pacingPct,
      cell: (row) => (
        <ProgressBar
          value={row.pacingPct ?? 0}
          tone="auto"
          thresholds={{ warn: 80, crit: 60 }}
          size="sm"
          format={(value) => `${value.toFixed(0)}%`}
          aria-label={`Pacing ${row.pacingPct.toFixed(0)}%`}
        />
      ),
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
      cell: (row) => (
        <div className="flex items-center gap-2">
          <Avatar name={row.owner} size="xs" />
          <span>{row.owner}</span>
        </div>
      ),
    },
  ], [campaignMap, onInspectCampaign]);

  const rowActions = useMemo(
    () => (row: PacingRow): DropdownMenuEntry[] => {
      const backingCampaign = campaignMap.get(row.id);
      if (!backingCampaign) return [];
      return [
        {
          id: 'view-detail',
          label: 'View detail',
          icon: <Eye className="h-4 w-4" />,
          onSelect: () => onInspectCampaign(backingCampaign),
        },
        {
          id: 'review-pacing',
          label: 'Review pacing',
          icon: <Gauge className="h-4 w-4" />,
          onSelect: () => onInspectCampaign(backingCampaign),
        },
        {
          id: 'view-full-campaign',
          label: 'View full campaign',
          icon: <Eye className="h-4 w-4" />,
          onSelect: () => navigate(`/campaigns/${backingCampaign.id}`),
        },
      ];
    },
    [campaignMap, navigate, onInspectCampaign],
  );

  return (
    <DataTable
      columns={columns}
      data={rows}
      rowKey={(row) => row.id}
      onRowClick={(row) => {
        const campaign = campaignMap.get(row.id);
        if (campaign) onInspectCampaign(campaign);
      }}
      density="comfortable"
      bordered={false}
      emptyState={null}
      rowActions={rowActions}
    />
  );
}
