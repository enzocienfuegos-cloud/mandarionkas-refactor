import React, { useMemo, useState } from 'react';
import type { Story } from '@ladle/react';
import {
  Badge,
  Button,
  DataTable,
  EmptyState,
  FilterBar,
  MetricCard,
  Modal,
  PageHeader,
  Panel,
  Skeleton,
  Stepper,
  TrendChart,
  type ColumnDef,
} from '../index';
import { CheckCircle2, Filter, Sparkles } from '../icons';

type DemoRow = {
  id: string;
  campaign: string;
  status: string;
  spend: string;
};

const DEMO_COLUMNS: ColumnDef<DemoRow>[] = [
  {
    id: 'campaign',
    header: 'Campaign',
    cell: (row) => row.campaign,
    sortAccessor: (row) => row.campaign,
  },
  {
    id: 'status',
    header: 'Status',
    cell: (row) => <Badge tone={row.status === 'At risk' ? 'warning' : 'success'}>{row.status}</Badge>,
    sortAccessor: (row) => row.status,
  },
  {
    id: 'spend',
    header: 'Spend',
    align: 'right',
    cell: (row) => row.spend,
    sortAccessor: (row) => row.spend,
  },
];

const DEMO_ROWS: DemoRow[] = [
  { id: '1', campaign: 'Homepage takeover', status: 'Healthy', spend: '$12,430' },
  { id: '2', campaign: 'Retail retargeting', status: 'At risk', spend: '$7,210' },
  { id: '3', campaign: 'CTV launch', status: 'Healthy', spend: '$18,992' },
];

export const Buttons: Story = () => (
  <div className="flex flex-wrap gap-3 p-6">
    <Button>Primary action</Button>
    <Button variant="secondary">Secondary</Button>
    <Button variant="ghost">Ghost</Button>
    <Button variant="danger">Danger</Button>
  </div>
);

export const Panels: Story = () => (
  <div className="max-w-3xl p-6">
    <Panel padding="lg">
      <PageHeader
        kicker="Monitoring"
        title="Pacing"
        meta="127 campaigns · last sync 2 min ago"
        secondaryActions={<Button variant="secondary">Export</Button>}
        alert={<span className="text-[color:var(--dusk-status-warning-fg)]">12 campaigns are drifting behind goal.</span>}
      />
    </Panel>
  </div>
);

export const Badges: Story = () => (
  <div className="flex flex-wrap gap-3 p-6">
    <Badge tone="info">Info</Badge>
    <Badge tone="success">Healthy</Badge>
    <Badge tone="warning">At risk</Badge>
    <Badge tone="critical">Blocked</Badge>
    <Badge tone="neutral">Draft</Badge>
  </div>
);

export const MetricCards: Story = () => (
  <div className="grid gap-4 p-6 md:grid-cols-3">
    <MetricCard label="Impressions" value="12.4M" tone="brand" series={[6, 8, 7, 10, 12]} />
    <MetricCard label="Spend" value="$48.2K" tone="warning" series={[22, 24, 28, 32, 31]} />
    <MetricCard label="Exceptions" value="4" tone="critical" series={[1, 1, 2, 3, 4]} />
  </div>
);

export const Tables: Story = () => (
  <div className="p-6">
    <DataTable
      columns={DEMO_COLUMNS}
      data={DEMO_ROWS}
      rowKey={(row) => row.id}
    />
  </div>
);

export const Modals: Story = () => {
  const [open, setOpen] = useState(true);
  return (
    <div className="p-6">
      <Button onClick={() => setOpen(true)}>Open modal</Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Publish tag"
        description="Final QA checkpoint before handoff."
        footer={<Button onClick={() => setOpen(false)}>Done</Button>}
      >
        <Panel className="border-[color:var(--dusk-status-info-border)] bg-[color:var(--dusk-status-info-bg)] p-4 text-sm text-[color:var(--dusk-status-info-fg)]">
          This tag is ready for trafficking once diagnostics and snippet review are complete.
        </Panel>
      </Modal>
    </div>
  );
};

export const EmptyStates: Story = () => (
  <div className="max-w-xl p-6">
    <Panel padding="none">
      <EmptyState
        icon={<CheckCircle2 />}
        kicker="All clear"
        title="No tags match the current filters"
        description="Reset filters or generate a new tag to continue trafficking."
      />
    </Panel>
  </div>
);

export const Skeletons: Story = () => (
  <div className="grid gap-4 p-6 md:grid-cols-3">
    <Skeleton className="h-24 rounded-xl" />
    <Skeleton className="h-24 rounded-xl" />
    <Skeleton className="h-24 rounded-xl" />
  </div>
);

export const Trends: Story = () => {
  const data = useMemo(
    () => [
      { date: 'Mon', delivered: 28, target: 30, projected: 29 },
      { date: 'Tue', delivered: 35, target: 34, projected: 36 },
      { date: 'Wed', delivered: 33, target: 36, projected: 35 },
      { date: 'Thu', delivered: 39, target: 40, projected: 38 },
      { date: 'Fri', delivered: 46, target: 44, projected: 45 },
    ],
    [],
  );

  return (
    <div className="max-w-4xl p-6">
      <Panel padding="lg">
        <TrendChart
          title="Workspace performance"
          description="Delivered, target and projected delivery for the last 5 checkpoints."
          data={data}
          xKey="date"
          series={[
            { key: 'delivered', label: 'Delivered', tone: 'brand' },
            { key: 'target', label: 'Target', tone: 'neutral', dashed: true },
            { key: 'projected', label: 'Projected', tone: 'warning' },
          ]}
        />
      </Panel>
    </div>
  );
};

export const Steppers: Story = () => (
  <div className="max-w-sm p-6">
    <Stepper
      steps={[
        { id: 'campaign', label: 'Campaign', description: 'Scope the tag to the right flight.', status: 'complete' },
        { id: 'format', label: 'Format', description: 'Lock delivery mode and size.', status: 'complete' },
        { id: 'creative', label: 'Creative', description: 'Bind the asset that will actually serve.', status: 'current', badge: { label: '1 pending', tone: 'warning' } },
        { id: 'qa', label: 'QA', description: 'Run diagnostics before publish.', status: 'upcoming' },
        { id: 'publish', label: 'Publish', description: 'Move to active after sign-off.', status: 'blocked' },
      ]}
    />
  </div>
);

export const Headers: Story = () => (
  <div className="max-w-4xl p-6">
    <PageHeader
      kicker="Operations"
      title="Discrepancies"
      meta="18 campaigns · last sync 4 min ago"
      primaryAction={<Button>Filter to critical</Button>}
      secondaryActions={<Button variant="secondary">Export</Button>}
      alert={<span className="text-[color:var(--dusk-status-warning-fg)]">3 campaigns have publisher variance above threshold.</span>}
    />
  </div>
);

export const Filters: Story = () => {
  const [status, setStatus] = useState('all');
  const [windowValue, setWindowValue] = useState('30d');
  const [search, setSearch] = useState('');

  return (
    <div className="max-w-4xl p-6">
      <FilterBar
        pills={[
          {
            id: 'window',
            label: 'Window',
            value: windowValue,
            options: [
              { value: '7d', label: 'Last 7 days' },
              { value: '30d', label: 'Last 30 days' },
            ],
            onChange: setWindowValue,
          },
          {
            id: 'status',
            label: 'Status',
            value: status,
            options: [
              { value: 'all', label: 'All statuses' },
              { value: 'healthy', label: 'Healthy' },
              { value: 'risk', label: 'At risk' },
            ],
            onChange: setStatus,
          },
        ]}
        search={{
          value: search,
          onChange: setSearch,
          placeholder: 'Search campaign or owner',
        }}
        activeFilterCount={[status !== 'all', windowValue !== '30d'].filter(Boolean).length}
        onResetAll={() => {
          setStatus('all');
          setWindowValue('30d');
          setSearch('');
        }}
      />
      <div className="mt-4 flex items-center gap-2 text-sm text-[color:var(--dusk-text-muted)]">
        <Filter className="h-4 w-4" />
        <span>Filters are interactive and keyboard-first.</span>
        <Sparkles className="h-4 w-4" />
      </div>
    </div>
  );
};

export default {
  title: 'System/Primitives',
};
