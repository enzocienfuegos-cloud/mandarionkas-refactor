import React from 'react';
import { Badge, DataTable, type ColumnDef } from '../../../system';
import type { CampaignPerformanceRow } from '../reporting.types';
import { WidgetPanel } from './WidgetPanel';

function statusTone(status: CampaignPerformanceRow['status']) {
  if (status === 'active') return 'success';
  if (status === 'limited') return 'warning';
  if (status === 'paused') return 'neutral';
  return 'info';
}

function fmtNum(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
}

export function DisplayTable({ title, rows, icon = 'campaign' }: { title: string; rows: CampaignPerformanceRow[]; icon?: 'campaign' | 'tag' | 'creative' }) {
  const columns: ColumnDef<CampaignPerformanceRow>[] = [
    {
      id: 'name',
      header: 'Name',
      cell: (row) => (
        <div>
          <span className="font-semibold text-[color:var(--dusk-text-primary)]">{row.name}</span>
          {row.secondaryLabel ? (
            <p className="mt-1 text-xs text-[color:var(--dusk-text-soft)]">{row.secondaryLabel}</p>
          ) : null}
        </div>
      ),
      sortAccessor: (row) => row.name,
    },
    {
      id: 'status',
      header: 'Status',
      cell: (row) => <Badge tone={statusTone(row.status)} size="sm">{row.status}</Badge>,
      sortAccessor: (row) => row.status,
    },
    {
      id: 'impressions',
      header: 'Impressions',
      align: 'right',
      numeric: true,
      cell: (row) => fmtNum(row.impressions),
      sortAccessor: (row) => row.impressions,
    },
    {
      id: 'clicks',
      header: 'Clicks',
      align: 'right',
      numeric: true,
      cell: (row) => fmtNum(row.clicks),
      sortAccessor: (row) => row.clicks,
    },
    ...(rows.some((row) => typeof row.spend === 'number')
      ? [{
        id: 'spend',
        header: 'Spend',
        align: 'right',
        numeric: true,
        sortAccessor: (row: CampaignPerformanceRow) => Number(row.spend ?? 0),
        cell: (row: CampaignPerformanceRow) => (
          <div className="text-right">
            <div>{new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: 'USD',
              maximumFractionDigits: 2,
            }).format(Number(row.spend ?? 0))}</div>
            {row.spendHelper ? (
              <p className="mt-1 max-w-[14rem] whitespace-normal text-xs leading-5 text-[color:var(--dusk-text-soft)]">
                {row.spendHelper}
              </p>
            ) : null}
          </div>
        ),
      } satisfies ColumnDef<CampaignPerformanceRow>]
      : []),
    {
      id: 'ctr',
      header: 'CTR',
      align: 'right',
      numeric: true,
      cell: (row) => `${row.ctr.toFixed(2)}%`,
      sortAccessor: (row) => row.ctr,
    },
  ];

  return (
    <WidgetPanel title={title} icon={icon} tone="fuchsia">
      <DataTable columns={columns} data={rows} rowKey={(row) => row.id} bordered={false} />
    </WidgetPanel>
  );
}
