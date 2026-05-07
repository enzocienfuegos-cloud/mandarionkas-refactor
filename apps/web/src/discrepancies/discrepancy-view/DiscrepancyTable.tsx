import React, { useMemo } from 'react';
import { Button, DataTable, type ColumnDef } from '../../system';
import type { DiscrepancyRow } from './types';
import { DiscrepancyStatusPill, SeverityPill } from './components';

export function DiscrepancyTable({
  rows,
  onInvestigate,
}: {
  rows: DiscrepancyRow[];
  onInvestigate: () => void;
}) {
  const columns = useMemo<ColumnDef<DiscrepancyRow>[]>(() => [
    {
      id: 'campaign',
      header: 'Campaign',
      sortAccessor: (row) => row.campaign,
      cell: (row) => (
        <div>
          <p className="font-semibold text-text-primary">{row.campaign}</p>
          <p className="mt-1 text-xs text-text-muted">{row.advertiser} · {row.publisher}</p>
        </div>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      sortAccessor: (row) => row.status,
      cell: (row) => <DiscrepancyStatusPill status={row.status} />,
    },
    {
      id: 'adserver',
      header: 'Adserver',
      align: 'right',
      numeric: true,
      sortAccessor: (row) => Number(row.adserver.replace(/[^0-9.-]/g, '')),
      cell: (row) => row.adserver,
    },
    {
      id: 'publisher',
      header: 'Publisher',
      align: 'right',
      numeric: true,
      sortAccessor: (row) => Number(row.publisherReported.replace(/[^0-9.-]/g, '')),
      cell: (row) => row.publisherReported,
    },
    {
      id: 'variance',
      header: 'Variance',
      align: 'right',
      numeric: true,
      sortAccessor: (row) => Number(row.variance.replace(/[^0-9.-]/g, '')),
      cell: (row) => <span className="font-medium text-text-primary">{row.variance}</span>,
    },
    {
      id: 'threshold',
      header: 'Threshold',
      align: 'right',
      numeric: true,
      sortAccessor: (row) => Number(row.threshold.replace(/[^0-9.-]/g, '')),
      cell: (row) => row.threshold,
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
      cell: () => (
        <Button type="button" onClick={onInvestigate} variant="secondary" size="sm">
          Investigate
        </Button>
      ),
    },
  ], [onInvestigate]);

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
