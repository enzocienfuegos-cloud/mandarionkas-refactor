import React, { useMemo, useState } from 'react';
import type { Story } from '@ladle/react';
import {
  Avatar,
  Badge,
  Button,
  ConfigurableMetricStrip,
  DataTable,
  DonutChart,
  Drawer,
  DropdownMenu,
  EmptyState,
  FilterBar,
  FunnelChart,
  Heatmap,
  MetricCard,
  Modal,
  PageHeader,
  Panel,
  ProgressBar,
  Skeleton,
  Stepper,
  Tooltip,
  TrendChart,
  type ColumnDef,
} from '../index';
import { AvatarGroup } from '../primitives/Avatar';
import { CheckCircle2, Filter, Pause, Sparkles, Trash2 } from '../icons';
import { overviewMetricScope } from '../../overview/overview.metrics';

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

export const Tooltips: Story = () => (
  <div className="flex flex-wrap items-center gap-4 p-6">
    <Tooltip content="Last sync 2 minutes ago">
      <span tabIndex={0} className="rounded-md border border-border-default px-3 py-2 text-sm text-text-primary">Status</span>
    </Tooltip>
    <Tooltip content="Click to pause delivery" side="right">
      <Button variant="ghost" size="sm" aria-label="Pause delivery">Pause</Button>
    </Tooltip>
    <Tooltip
      content={<><strong>Underpacing</strong><div>Below 80% of expected delivery.</div></>}
      side="top"
    >
      <span tabIndex={0}><Badge tone="warning">Underpacing</Badge></span>
    </Tooltip>
  </div>
);

export const Avatars: Story = () => (
  <div className="flex flex-wrap items-center gap-6 p-6">
    <Avatar name="Verga López" />
    <Avatar name="Juan Carlos" size="md" />
    <AvatarGroup max={3} size="xs">
      <Avatar name="Verga López" size="xs" />
      <Avatar name="Juan Carlos" size="xs" />
      <Avatar name="María A." size="xs" />
      <Avatar name="Diego R." size="xs" />
      <Avatar name="Sofía V." size="xs" />
    </AvatarGroup>
  </div>
);

export const ProgressBars: Story = () => (
  <div className="grid max-w-2xl gap-4 p-6">
    <ProgressBar value={75} />
    <ProgressBar value={42} tone="auto" thresholds={{ warn: 70, crit: 50 }} />
    <ProgressBar value={68} target={80} tone="auto" />
    <ProgressBar value={92} tone="success" size="lg" />
  </div>
);

export const MetricCards: Story = () => (
  <div className="grid gap-4 p-6 md:grid-cols-3">
    <MetricCard label="Impressions" value="12.4M" tone="brand" series={[6, 8, 7, 10, 12]} />
    <MetricCard label="Spend" value="$48.2K" tone="warning" series={[22, 24, 28, 32, 31]} />
    <MetricCard label="Exceptions" value="4" tone="critical" series={[1, 1, 2, 3, 4]} />
  </div>
);

export const ConfigurableMetrics: Story = () => (
  <div className="p-6">
    <ConfigurableMetricStrip
      scope={overviewMetricScope}
      data={{
        currentStats: {
          total_impressions: 1240000,
          total_clicks: 18400,
          avg_ctr: 1.48,
          measurable_rate: 81,
          viewability_rate: 69,
          total_hover_duration_ms: 220000,
          total_engagements: 5400,
          total_spend: 48210,
          active_campaigns: 28,
          active_tags: 146,
          total_creatives: 84,
        },
        previousStats: {
          total_impressions: 1185000,
          total_clicks: 17620,
          avg_ctr: 1.41,
          measurable_rate: 79,
          viewability_rate: 66,
          total_hover_duration_ms: 198000,
          total_engagements: 5010,
          total_spend: 45600,
          active_campaigns: 26,
          active_tags: 138,
          total_creatives: 80,
        },
        timeline: [
          { date: '2026-05-01', impressions: 182000, clicks: 2600, ctr: 1.43, spend: 6900, viewability_rate: 66 },
          { date: '2026-05-02', impressions: 194000, clicks: 2780, ctr: 1.43, spend: 7140, viewability_rate: 67 },
          { date: '2026-05-03', impressions: 205000, clicks: 3010, ctr: 1.47, spend: 7520, viewability_rate: 68 },
          { date: '2026-05-04', impressions: 212000, clicks: 3200, ctr: 1.51, spend: 8010, viewability_rate: 69 },
          { date: '2026-05-05', impressions: 224000, clicks: 3360, ctr: 1.5, spend: 8430, viewability_rate: 70 },
          { date: '2026-05-06', impressions: 229000, clicks: 3490, ctr: 1.52, spend: 8970, viewability_rate: 69 },
        ],
        attentionItemsCount: 5,
      }}
    />
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

export const Menus: Story = () => (
  <div className="p-6">
    <DropdownMenu
      trigger={<Button variant="ghost" size="sm">Open menu</Button>}
      items={[
        { type: 'label', text: 'Quick actions' },
        { id: 'pause', label: 'Pause delivery', icon: <Pause className="h-4 w-4" />, onSelect: () => {} },
        { type: 'separator' },
        { id: 'delete', label: 'Delete', icon: <Trash2 className="h-4 w-4" />, danger: true, onSelect: () => {} },
      ]}
    />
  </div>
);

export const Drawers: Story = () => (
  <Drawer
    open
    onClose={() => {}}
    title="BocaDeli WC26"
    subtitle="320×480 · 4 placements · 12 days remaining"
    footer={<><Button variant="secondary">Close</Button><Button>Save changes</Button></>}
  >
    <p className="text-sm text-text-secondary">Drawer body content goes here.</p>
  </Drawer>
);

export const Donuts: Story = () => (
  <div className="p-6">
    <DonutChart
      title="Campaign status mix"
      description="Share of campaigns by operational status."
      centerLabel="28"
      centerSubLabel="campaigns"
      segments={[
        { id: 'live', label: 'Live', value: 16, tone: 'success' },
        { id: 'review', label: 'Need review', value: 7, tone: 'warning' },
        { id: 'draft', label: 'Drafts', value: 5, tone: 'neutral' },
      ]}
    />
  </div>
);

export const Funnels: Story = () => (
  <div className="max-w-2xl p-6">
    <FunnelChart
      title="Delivery funnel"
      description="Impressions to clicks."
      stages={[
        { id: 'impressions', label: 'Impressions', value: 10000 },
        { id: 'measurable', label: 'Measurable', value: 8200 },
        { id: 'viewable', label: 'Viewable', value: 4900 },
        { id: 'clicks', label: 'Clicks', value: 320 },
      ]}
    />
  </div>
);

export const Heatmaps: Story = () => (
  <div className="max-w-4xl p-6">
    <Heatmap
      title="Discrepancy heatmap"
      description="Variance by publisher and day."
      tone="warning"
      xLabels={['Mon', 'Tue', 'Wed', 'Thu', 'Fri']}
      yLabels={['Publisher A', 'Publisher B', 'Publisher C']}
      cells={[
        { x: 'Mon', y: 'Publisher A', value: 0.8 },
        { x: 'Tue', y: 'Publisher A', value: 0.4 },
        { x: 'Thu', y: 'Publisher B', value: 0.7 },
        { x: 'Wed', y: 'Publisher C', value: 0.2 },
      ]}
      format={(value) => `${value.toFixed(1)}%`}
    />
  </div>
);

export default {
  title: 'System/Primitives',
};
