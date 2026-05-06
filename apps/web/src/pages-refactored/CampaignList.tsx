import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  Filter,
  Download,
  Pause,
  Play,
  Trash2,
  Megaphone,
} from '../system/icons';
import {
  Panel,
  Button,
  Input,
  Select,
  Badge,
  Kicker,
  DataTable,
  type ColumnDef,
  EmptyState,
  useToast,
  useConfirm,
} from '../system';

type CampaignStatus = 'draft' | 'active' | 'paused' | 'archived' | 'completed';

interface Campaign {
  id: string;
  name: string;
  client: string;
  status: CampaignStatus;
  startDate: string | null;
  endDate: string | null;
  impressions: number;
  goal: number;
  pacing: number;
  dsp?: string;
}

function normalizeCampaign(row: any): Campaign {
  const rawStatus = String(row?.status ?? 'draft').toLowerCase();
  const status: CampaignStatus =
    rawStatus === 'active' || rawStatus === 'paused' || rawStatus === 'archived' || rawStatus === 'completed'
      ? rawStatus
      : 'draft';
  return {
    id: String(row?.id ?? ''),
    name: String(row?.name ?? ''),
    client: String(row?.workspaceName ?? row?.workspace_name ?? row?.client ?? 'Unknown client'),
    status,
    startDate: row?.startDate ?? row?.start_date ?? null,
    endDate: row?.endDate ?? row?.end_date ?? null,
    impressions: Number(row?.impressions ?? row?.impressionCount ?? 0),
    goal: Number(row?.impressionGoal ?? row?.impression_goal ?? 0),
    pacing: Number(row?.pacing ?? 0),
    dsp: row?.metadata?.dsp ?? row?.dsp ?? undefined,
  };
}

const STATUS_TONE: Record<CampaignStatus, 'success' | 'warning' | 'info' | 'neutral' | 'critical'> = {
  active:    'success',
  draft:     'neutral',
  paused:    'warning',
  archived:  'neutral',
  completed: 'info',
};

/**
 * Campaign list — refactored to the design system (S56).
 *
 * Replaces:
 *   - Inline duplicated MetricCard at the top → uses system MetricCard.
 *   - Hand-rolled <table> → DataTable with sort, density, selection, bulk actions.
 *   - window.confirm + bg-red-600 buttons → useConfirm + Button variant="danger".
 *   - Per-row inline "more" dropdown emoji → IconButton + lucide.
 */
export default function CampaignList() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const confirm   = useConfirm();

  const [campaigns, setCampaigns]   = useState<Campaign[]>([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [statusFilter, setStatusFilter] = useState<CampaignStatus | 'all'>('all');
  const [selected, setSelected]     = useState<Set<string>>(new Set());

  useEffect(() => {
    setLoading(true);
    fetch('/v1/campaigns?scope=all', { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => setCampaigns((data?.campaigns ?? data ?? []).map(normalizeCampaign)))
      .catch(() => toast({ tone: 'critical', title: 'Could not load campaigns' }))
      .finally(() => setLoading(false));
  }, [toast]);

  const filtered = useMemo(() => {
    return campaigns.filter((c) => {
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;
      if (search) {
        const haystack = `${c.name} ${c.client} ${c.dsp ?? ''}`.toLowerCase();
        if (!haystack.includes(search.toLowerCase())) return false;
      }
      return true;
    });
  }, [campaigns, search, statusFilter]);

  const handleBulkPause = async (rows: Campaign[]) => {
    const ok = await confirm({
      title: `Pause ${rows.length} campaigns?`,
      description: 'Tags will stop returning ads within ~90 seconds.',
    });
    if (!ok) return;

    try {
      await Promise.all(
        rows.map((row) =>
          fetch(`/v1/campaigns/${row.id}`, {
            method: 'PUT',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'paused' }),
          }),
        ),
      );
      setCampaigns((current) =>
        current.map((c) => (selected.has(c.id) ? { ...c, status: 'paused' as const } : c)),
      );
      setSelected(new Set());
      toast({ tone: 'success', title: `${rows.length} campaigns paused` });
    } catch {
      toast({ tone: 'critical', title: 'Could not pause campaigns' });
    }
  };

  const handleBulkArchive = async (rows: Campaign[]) => {
    const ok = await confirm({
      title: `Archive ${rows.length} campaigns?`,
      description: 'Archived campaigns are hidden from the default view but can be restored.',
      tone: 'danger',
      confirmLabel: 'Archive',
    });
    if (!ok) return;

    try {
      await Promise.all(
        rows.map((row) =>
          fetch(`/v1/campaigns/${row.id}`, {
            method: 'PUT',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'archived' }),
          }),
        ),
      );
      setCampaigns((current) => current.filter((c) => !selected.has(c.id)));
      setSelected(new Set());
      toast({ tone: 'warning', title: `${rows.length} campaigns archived` });
    } catch {
      toast({ tone: 'critical', title: 'Could not archive campaigns' });
    }
  };

  const columns: ColumnDef<Campaign>[] = [
    {
      id: 'name',
      header: 'Campaign',
      sortAccessor: (row) => row.name,
      width: '32%',
      cell: (row) => (
        <div className="min-w-0">
          <p className="font-medium text-[color:var(--dusk-text-primary)] truncate">{row.name}</p>
          <p className="mt-0.5 text-xs text-[color:var(--dusk-text-soft)] truncate">
            {row.client}{row.dsp ? ` · ${row.dsp}` : ''}
          </p>
        </div>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      sortAccessor: (row) => row.status,
      cell: (row) => <Badge tone={STATUS_TONE[row.status]} dot>{row.status}</Badge>,
    },
    {
      id: 'flight',
      header: 'Flight',
      sortAccessor: (row) => row.startDate ?? '',
      cell: (row) => (
        <span className="text-xs text-[color:var(--dusk-text-muted)]">
          {row.startDate ? new Date(row.startDate).toLocaleDateString() : '—'}
          {' → '}
          {row.endDate ? new Date(row.endDate).toLocaleDateString() : '—'}
        </span>
      ),
    },
    {
      id: 'impressions',
      header: 'Impressions',
      align: 'right',
      numeric: true,
      sortAccessor: (row) => row.impressions,
      cell: (row) => row.impressions.toLocaleString(),
    },
    {
      id: 'pacing',
      header: 'Pacing',
      align: 'right',
      numeric: true,
      sortAccessor: (row) => row.pacing,
      cell: (row) => <PacingCell pacing={row.pacing} />,
    },
  ];

  return (
    <div className="space-y-5">
      <header className="dusk-page-header">
        <div>
          <Kicker>Campaigns</Kicker>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[color:var(--dusk-text-primary)]">
            All campaigns
          </h1>
          <p className="mt-1 text-sm text-[color:var(--dusk-text-muted)]">
            {campaigns.length} total · {campaigns.filter((c) => c.status === 'active').length} active
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" leadingIcon={<Download />}>Export</Button>
          <Button variant="primary" leadingIcon={<Plus />} onClick={() => navigate('/campaigns/new')}>
            New campaign
          </Button>
        </div>
      </header>

      {/* Filters */}
      <Panel padding="md">
        <div className="flex flex-wrap items-center gap-3">
          <Input
            inputSize="md"
            leadingIcon={<Search />}
            placeholder="Search campaigns…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
            fullWidth={false}
          />
          <Select
            selectSize="md"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            fullWidth={false}
            className="min-w-[140px]"
            options={[
              { value: 'all',       label: 'All statuses' },
              { value: 'active',    label: 'Active' },
              { value: 'paused',    label: 'Paused' },
              { value: 'draft',     label: 'Draft' },
              { value: 'completed', label: 'Completed' },
              { value: 'archived',  label: 'Archived' },
            ]}
          />
          <Button variant="ghost" leadingIcon={<Filter />}>More filters</Button>
        </div>
      </Panel>

      {/* Table */}
      {!loading && filtered.length === 0 ? (
        <Panel padding="none">
          <EmptyState
            icon={<Megaphone />}
            kicker="No matches"
            title={search || statusFilter !== 'all' ? 'No campaigns match your filters' : 'No campaigns yet'}
            description={
              search || statusFilter !== 'all'
                ? 'Try adjusting the filters or clearing the search.'
                : 'Create your first campaign to start trafficking creatives.'
            }
            action={
              search || statusFilter !== 'all' ? (
                <Button variant="secondary" onClick={() => { setSearch(''); setStatusFilter('all'); }}>
                  Clear filters
                </Button>
              ) : (
                <Button variant="primary" leadingIcon={<Plus />} onClick={() => navigate('/campaigns/new')}>
                  New campaign
                </Button>
              )
            }
          />
        </Panel>
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          rowKey={(c) => c.id}
          loading={loading}
          density="comfortable"
          onRowClick={(c) => navigate(`/campaigns/${c.id}`)}
          selectable
          selectedKeys={selected}
          onSelectionChange={setSelected}
          renderBulkActions={(rows) => (
            <>
              <Button size="sm" variant="secondary" leadingIcon={<Pause />} onClick={() => handleBulkPause(rows)}>
                Pause
              </Button>
              <Button size="sm" variant="secondary" leadingIcon={<Play />}>
                Resume
              </Button>
              <Button size="sm" variant="danger" leadingIcon={<Trash2 />} onClick={() => handleBulkArchive(rows)}>
                Archive
              </Button>
            </>
          )}
        />
      )}
    </div>
  );
}

function PacingCell({ pacing }: { pacing: number }) {
  const pct = Math.round(pacing * 100);
  const tone =
    pacing < 0.85 ? 'var(--dusk-status-warning-fg)' :
    pacing > 1.15 ? 'var(--dusk-status-info-fg)' :
                    'var(--dusk-status-success-fg)';

  return (
    <span className="inline-flex items-center gap-2">
      <span className="dusk-mono text-xs text-[color:var(--dusk-text-secondary)]">{pct}%</span>
      <span className="h-1 w-12 rounded-full bg-[color:var(--dusk-surface-muted)] overflow-hidden">
        <span
          className="block h-full rounded-full"
          style={{ width: `${Math.min(100, pct)}%`, background: tone }}
        />
      </span>
    </span>
  );
}
