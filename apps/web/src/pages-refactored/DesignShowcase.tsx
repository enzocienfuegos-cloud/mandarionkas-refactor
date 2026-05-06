import React, { useState } from 'react';
import {
  Plus,
  Eye,
  Megaphone,
  Search,
  AlertTriangle,
  Trash2,
  Settings,
  Inbox,
} from '../system/icons';
import {
  Panel,
  PanelHeader,
  Button,
  IconButton,
  Input,
  FormField,
  Select,
  Badge,
  Kicker,
  Tabs,
  TabsList,
  Tab,
  TabPanel,
  Modal,
  Skeleton,
  Spinner,
  EmptyState,
  MetricCard,
  Sparkline,
  DataTable,
  type ColumnDef,
  useToast,
  useConfirm,
} from '../system';

interface Row {
  id: string;
  name: string;
  status: 'active' | 'paused' | 'archived';
  impressions: number;
  ctr: number;
}

const DEMO_ROWS: Row[] = [
  { id: '1', name: 'Q4 Brand Awareness', status: 'active',   impressions: 1_240_000, ctr: 0.0182 },
  { id: '2', name: 'Holiday Promo',      status: 'paused',   impressions:   840_000, ctr: 0.0214 },
  { id: '3', name: 'Always-On Retarget', status: 'active',   impressions: 4_120_000, ctr: 0.0341 },
  { id: '4', name: 'Test Variant A',     status: 'archived', impressions:   120_000, ctr: 0.0098 },
];

/**
 * Visual showcase of every design system primitive.
 *
 * Mount this at /design-system (or any internal route) to QA the system
 * after migrations. Useful as a sanity check after upgrading any token.
 */
export default function DesignShowcase() {
  const { toast } = useToast();
  const confirm   = useConfirm();
  const [tab, setTab]         = useState('buttons');
  const [modalOpen, setModalOpen] = useState(false);
  const [selected, setSelected]   = useState<Set<string>>(new Set());

  return (
    <div className="space-y-6 max-w-content mx-auto">
      <header className="dusk-page-header">
        <div>
          <Kicker>Internal</Kicker>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[color:var(--dusk-text-primary)]">
            Design System Showcase
          </h1>
          <p className="mt-1 text-sm text-[color:var(--dusk-text-muted)]">
            Living catalogue of every primitive. Toggle theme to verify both modes.
          </p>
        </div>
      </header>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList aria-label="Showcase sections">
          <Tab value="buttons">Buttons</Tab>
          <Tab value="inputs">Inputs</Tab>
          <Tab value="display">Display</Tab>
          <Tab value="data">Data</Tab>
          <Tab value="feedback">Feedback</Tab>
          <Tab value="empty">Empty / Loading</Tab>
        </TabsList>

        {/* ───── Buttons ───── */}
        <TabPanel value="buttons">
          <Panel padding="lg">
            <PanelHeader title="Button" subtitle="4 variants × 3 sizes" />
            <div className="space-y-4">
              <Row label="Primary">
                <Button variant="primary" size="sm">Small</Button>
                <Button variant="primary">Medium</Button>
                <Button variant="primary" size="lg">Large</Button>
                <Button variant="primary" leadingIcon={<Plus />}>With icon</Button>
                <Button variant="primary" loading>Loading</Button>
                <Button variant="primary" disabled>Disabled</Button>
              </Row>
              <Row label="Secondary">
                <Button variant="secondary" size="sm">Small</Button>
                <Button variant="secondary">Medium</Button>
                <Button variant="secondary" size="lg">Large</Button>
              </Row>
              <Row label="Ghost">
                <Button variant="ghost" size="sm">Small</Button>
                <Button variant="ghost">Medium</Button>
                <Button variant="ghost" leadingIcon={<Search />}>With icon</Button>
              </Row>
              <Row label="Danger">
                <Button variant="danger" size="sm">Small</Button>
                <Button variant="danger" leadingIcon={<Trash2 />}>Delete</Button>
              </Row>
              <Row label="Icon only">
                <IconButton icon={<Settings />} aria-label="Settings" size="sm" />
                <IconButton icon={<Settings />} aria-label="Settings" />
                <IconButton icon={<Settings />} aria-label="Settings" size="lg" />
                <IconButton icon={<Settings />} aria-label="Settings" variant="primary" />
                <IconButton icon={<Trash2 />}   aria-label="Delete"   variant="danger" />
              </Row>
            </div>
          </Panel>
        </TabPanel>

        {/* ───── Inputs ───── */}
        <TabPanel value="inputs">
          <Panel padding="lg">
            <PanelHeader title="Form fields" />
            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="Default input" helper="With helper text">
                <Input placeholder="Type something…" />
              </FormField>
              <FormField label="With leading icon" required>
                <Input leadingIcon={<Search />} placeholder="Search" />
              </FormField>
              <FormField label="Invalid state" error="This field is required">
                <Input invalid value="" />
              </FormField>
              <FormField label="Select">
                <Select
                  options={[
                    { value: 'a', label: 'Option A' },
                    { value: 'b', label: 'Option B' },
                  ]}
                />
              </FormField>
              <FormField label="Date">
                <Input type="date" />
              </FormField>
              <FormField label="Number">
                <Input type="number" placeholder="0" />
              </FormField>
            </div>
          </Panel>
        </TabPanel>

        {/* ───── Display ───── */}
        <TabPanel value="display">
          <div className="space-y-4">
            <Panel padding="lg">
              <PanelHeader title="Badges" />
              <Row label="Soft (default)">
                <Badge tone="success">Live</Badge>
                <Badge tone="warning">Pending</Badge>
                <Badge tone="critical">Failed</Badge>
                <Badge tone="info">Beta</Badge>
                <Badge tone="neutral">Draft</Badge>
                <Badge tone="brand">Featured</Badge>
              </Row>
              <Row label="Solid">
                <Badge tone="success" variant="solid">12</Badge>
                <Badge tone="warning" variant="solid">3</Badge>
                <Badge tone="critical" variant="solid">!</Badge>
              </Row>
              <Row label="Outline">
                <Badge tone="success" variant="outline">300x250</Badge>
                <Badge tone="info" variant="outline">VIDEO</Badge>
              </Row>
              <Row label="With dot">
                <Badge tone="success" dot>active</Badge>
                <Badge tone="warning" dot>paused</Badge>
                <Badge tone="critical" dot>error</Badge>
              </Row>
            </Panel>

            <Panel padding="lg">
              <PanelHeader title="Metric cards" />
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard
                  label="Impressions"
                  value="12.4M"
                  delta="+8.2%"
                  trend="up"
                  series={[120, 145, 132, 158, 174, 162, 188]}
                  tone="brand"
                  icon={<Eye />}
                  onClick={() => toast({ tone: 'info', title: 'MetricCard click' })}
                />
                <MetricCard
                  label="CTR"
                  value="2.34%"
                  delta="-0.4%"
                  trend="down"
                  series={[0.025, 0.022, 0.024, 0.021, 0.022, 0.020, 0.023]}
                  tone="success"
                />
                <MetricCard
                  label="Pacing"
                  value="98%"
                  context="On goal"
                  tone="warning"
                />
                <MetricCard label="" value="" loading />
              </div>
            </Panel>

            <Panel padding="lg">
              <PanelHeader title="Sparkline" subtitle="Standalone, can be reused outside MetricCard" />
              <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
                <Sparkline series={[2, 5, 3, 7, 4, 8, 9]} tone="brand" />
                <Sparkline series={[9, 8, 4, 6, 3, 2, 1]} tone="critical" />
                <Sparkline series={[5, 5, 5, 5, 5, 5, 5]} tone="neutral" />
                <Sparkline series={[1, 3, 2, 4, 3, 5, 6]} tone="success" />
              </div>
            </Panel>
          </div>
        </TabPanel>

        {/* ───── Data ───── */}
        <TabPanel value="data">
          <Panel padding="none">
            <PanelHeader title="DataTable" className="px-6 pt-6" />
            <DataTable
              columns={tableColumns}
              data={DEMO_ROWS}
              rowKey={(r) => r.id}
              selectable
              selectedKeys={selected}
              onSelectionChange={setSelected}
              renderBulkActions={(rows) => (
                <Button size="sm" variant="danger">Archive {rows.length}</Button>
              )}
              bordered={false}
            />
          </Panel>
        </TabPanel>

        {/* ───── Feedback ───── */}
        <TabPanel value="feedback">
          <Panel padding="lg">
            <PanelHeader title="Toast" subtitle="Click to fire each tone" />
            <Row>
              <Button onClick={() => toast({ tone: 'success', title: 'Saved successfully' })}>
                Success
              </Button>
              <Button onClick={() => toast({ tone: 'warning', title: 'Heads up', description: 'Pacing is 18% behind goal.' })}>
                Warning
              </Button>
              <Button onClick={() => toast({ tone: 'critical', title: 'Could not save', description: 'Network error' })}>
                Critical
              </Button>
              <Button
                onClick={() =>
                  toast({
                    tone: 'info',
                    title: 'New report ready',
                    description: 'Q4 reporting export is available.',
                    action: { label: 'View', onClick: () => toast({ tone: 'neutral', title: 'Action clicked' }) },
                    duration: 0,
                  })
                }
              >
                Info + action
              </Button>
            </Row>
          </Panel>

          <Panel padding="lg" className="mt-4">
            <PanelHeader title="Confirm" />
            <Row>
              <Button
                onClick={async () => {
                  const ok = await confirm({
                    title: 'Continue?',
                    description: 'This is a non-destructive action.',
                  });
                  toast({ tone: ok ? 'success' : 'neutral', title: ok ? 'Confirmed' : 'Cancelled' });
                }}
              >
                Default
              </Button>
              <Button
                variant="danger"
                onClick={async () => {
                  const ok = await confirm({
                    title: 'Delete this thing?',
                    description: 'This cannot be undone.',
                    tone: 'danger',
                  });
                  toast({ tone: ok ? 'warning' : 'neutral', title: ok ? 'Deleted' : 'Cancelled' });
                }}
              >
                Danger
              </Button>
              <Button
                variant="danger"
                onClick={async () => {
                  const ok = await confirm({
                    title: 'Type to confirm',
                    description: 'Irreversible. Type the campaign name to enable the button.',
                    tone: 'danger',
                    requireTypeToConfirm: 'Q4 Brand',
                  });
                  toast({ tone: ok ? 'warning' : 'neutral', title: ok ? 'Deleted' : 'Cancelled' });
                }}
              >
                Type to confirm
              </Button>
            </Row>
          </Panel>

          <Panel padding="lg" className="mt-4">
            <PanelHeader title="Modal" />
            <Button onClick={() => setModalOpen(true)}>Open modal</Button>
            <Modal
              open={modalOpen}
              onClose={() => setModalOpen(false)}
              title="Sample modal"
              description="Focus is trapped, ESC closes, body scroll is locked."
              footer={
                <>
                  <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
                  <Button variant="primary" onClick={() => setModalOpen(false)}>Save</Button>
                </>
              }
            >
              <FormField label="Name">
                <Input placeholder="Type something…" />
              </FormField>
            </Modal>
          </Panel>
        </TabPanel>

        {/* ───── Empty / Loading ───── */}
        <TabPanel value="empty">
          <div className="grid gap-4 md:grid-cols-2">
            <Panel padding="none">
              <EmptyState
                icon={<Inbox />}
                kicker="No data"
                title="No campaigns yet"
                description="Create your first campaign to start trafficking creatives."
                action={<Button variant="primary" leadingIcon={<Megaphone />}>New campaign</Button>}
              />
            </Panel>
            <Panel padding="none">
              <EmptyState
                icon={<AlertTriangle />}
                title="No discrepancies detected"
                description="When metrics from your ad server diverge from DSP reports, alerts will appear here."
              />
            </Panel>
            <Panel padding="lg">
              <PanelHeader title="Skeletons" />
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            </Panel>
            <Panel padding="lg">
              <PanelHeader title="Spinners" />
              <div className="flex items-center gap-6">
                <Spinner size="sm" />
                <Spinner size="md" />
                <Spinner size="lg" />
              </div>
            </Panel>
          </div>
        </TabPanel>
      </Tabs>
    </div>
  );
}

const tableColumns: ColumnDef<Row>[] = [
  {
    id: 'name',
    header: 'Campaign',
    sortAccessor: (row) => row.name,
    cell: (row) => <span className="font-medium">{row.name}</span>,
  },
  {
    id: 'status',
    header: 'Status',
    sortAccessor: (row) => row.status,
    cell: (row) => (
      <Badge tone={row.status === 'active' ? 'success' : row.status === 'paused' ? 'warning' : 'neutral'} dot>
        {row.status}
      </Badge>
    ),
  },
  {
    id: 'imps',
    header: 'Impressions',
    align: 'right',
    numeric: true,
    sortAccessor: (row) => row.impressions,
    cell: (row) => row.impressions.toLocaleString(),
  },
  {
    id: 'ctr',
    header: 'CTR',
    align: 'right',
    numeric: true,
    sortAccessor: (row) => row.ctr,
    cell: (row) => `${(row.ctr * 100).toFixed(2)}%`,
  },
];

function Row({ label, children }: { label?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      {label && <span className="dusk-kicker w-24 shrink-0">{label}</span>}
      {children}
    </div>
  );
}
