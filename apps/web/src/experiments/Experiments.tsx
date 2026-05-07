import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  FlaskConical,
  TrendingUp,
  Pause,
  Play,
} from '../system/icons';
import {
  Panel,
  Button,
  Input,
  Select,
  Badge,
  Kicker,
  MetricCard,
  DataTable,
  type ColumnDef,
  EmptyState,
  useToast,
} from '../system';

type ExperimentStatus = 'draft' | 'running' | 'paused' | 'completed';

interface Experiment {
  id: string;
  name: string;
  hypothesis: string;
  status: ExperimentStatus;
  metric: string;
  variantCount: number;
  trafficShare: number;
  startedAt: string | null;
  endedAt: string | null;
  /** −1 to +1, signed lift for the leading variant */
  liftPct: number | null;
  /** 0..1 statistical confidence */
  confidence: number | null;
}

const STATUS_TONE: Record<ExperimentStatus, 'neutral' | 'info' | 'warning' | 'success'> = {
  draft:     'neutral',
  running:   'info',
  paused:    'warning',
  completed: 'success',
};

/**
 * Experiments list — refactored to the design system (S57).
 *
 * Pairs with `AbExperimentEditor.tsx` (already refactored in S56). The
 * editor handles a single experiment; this page is the index.
 */
export default function Experiments() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [items, setItems]       = useState<Experiment[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [statusFilter, setStatusFilter] = useState<ExperimentStatus | 'all'>('all');

  useEffect(() => {
    setLoading(true);
    fetch('/v1/experiments', { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => setItems(data?.items ?? []))
      .catch(() => toast({ tone: 'critical', title: 'Could not load experiments' }))
      .finally(() => setLoading(false));
  }, [toast]);

  const filtered = useMemo(() => {
    return items.filter((it) => {
      if (statusFilter !== 'all' && it.status !== statusFilter) return false;
      if (search) {
        const haystack = `${it.name} ${it.hypothesis} ${it.metric}`.toLowerCase();
        if (!haystack.includes(search.toLowerCase())) return false;
      }
      return true;
    });
  }, [items, search, statusFilter]);

  const summary = useMemo(() => {
    const running   = items.filter((it) => it.status === 'running').length;
    const completed = items.filter((it) => it.status === 'completed').length;
    const winners   = items.filter(
      (it) => it.status === 'completed' && (it.confidence ?? 0) >= 0.95 && (it.liftPct ?? 0) > 0,
    ).length;
    const avgLift = (() => {
      const wins = items.filter((it) => it.status === 'completed' && it.liftPct != null);
      if (wins.length === 0) return 0;
      return wins.reduce((sum, it) => sum + (it.liftPct ?? 0), 0) / wins.length;
    })();
    return { running, completed, winners, avgLift };
  }, [items]);

  const columns: ColumnDef<Experiment>[] = [
    {
      id: 'name',
      header: 'Experiment',
      width: '34%',
      sortAccessor: (row) => row.name,
      cell: (row) => (
        <div className="min-w-0">
          <p className="font-medium text-[color:var(--dusk-text-primary)] truncate">{row.name}</p>
          <p className="mt-0.5 text-xs text-[color:var(--dusk-text-soft)] truncate">
            {row.hypothesis || <span className="italic">No hypothesis recorded</span>}
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
      id: 'metric',
      header: 'Metric',
      sortAccessor: (row) => row.metric,
      cell: (row) => (
        <span className="dusk-mono text-xs text-[color:var(--dusk-text-secondary)]">{row.metric}</span>
      ),
    },
    {
      id: 'variants',
      header: 'Variants',
      align: 'right',
      numeric: true,
      sortAccessor: (row) => row.variantCount,
      cell: (row) => row.variantCount,
    },
    {
      id: 'lift',
      header: 'Lift',
      align: 'right',
      numeric: true,
      sortAccessor: (row) => row.liftPct ?? -Infinity,
      cell: (row) => {
        if (row.liftPct == null) return <span className="text-[color:var(--dusk-text-soft)]">—</span>;
        const significant = (row.confidence ?? 0) >= 0.95;
        const positive = row.liftPct > 0;
        return (
          <span
            className="dusk-mono text-xs font-medium"
            style={{
              color: significant
                ? positive
                  ? 'var(--dusk-status-success-fg)'
                  : 'var(--dusk-status-critical-fg)'
                : 'var(--dusk-text-secondary)',
            }}
          >
            {positive ? '+' : ''}{(row.liftPct * 100).toFixed(1)}%
          </span>
        );
      },
    },
    {
      id: 'confidence',
      header: 'Confidence',
      align: 'right',
      numeric: true,
      sortAccessor: (row) => row.confidence ?? -1,
      cell: (row) =>
        row.confidence == null ? (
          <span className="text-[color:var(--dusk-text-soft)]">—</span>
        ) : (
          <span className="dusk-mono text-xs">{Math.round(row.confidence * 100)}%</span>
        ),
    },
    {
      id: 'duration',
      header: 'Duration',
      sortAccessor: (row) => row.startedAt ?? '',
      cell: (row) => {
        if (!row.startedAt) return <span className="text-[color:var(--dusk-text-soft)]">—</span>;
        const start = new Date(row.startedAt);
        const end   = row.endedAt ? new Date(row.endedAt) : new Date();
        const days  = Math.max(1, Math.round((+end - +start) / 86400000));
        return (
          <span className="text-xs text-[color:var(--dusk-text-muted)]">
            {days} day{days === 1 ? '' : 's'}
          </span>
        );
      },
    },
  ];

  return (
    <div className="space-y-5">
      <header className="dusk-page-header">
        <div>
          <Kicker>Experiments</Kicker>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[color:var(--dusk-text-primary)]">
            A/B experiments
          </h1>
          <p className="mt-1 text-sm text-[color:var(--dusk-text-muted)]">
            Hypothesis-driven creative and targeting tests across the workspace.
          </p>
        </div>
        <Button variant="primary" leadingIcon={<Plus />} onClick={() => navigate('/experiments/new')}>
          New experiment
        </Button>
      </header>

      <div className="grid gap-4 grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Running"
          value={summary.running}
          tone="info"
          icon={<Play />}
          loading={loading}
        />
        <MetricCard
          label="Completed"
          value={summary.completed}
          tone="success"
          icon={<TrendingUp />}
          loading={loading}
        />
        <MetricCard
          label="Significant wins"
          value={summary.winners}
          tone="brand"
          icon={<FlaskConical />}
          context="≥95% confidence with positive lift"
          loading={loading}
        />
        <MetricCard
          label="Avg lift"
          value={`${summary.avgLift > 0 ? '+' : ''}${(summary.avgLift * 100).toFixed(1)}%`}
          tone={summary.avgLift > 0 ? 'success' : 'warning'}
          context="Across all completed experiments"
          loading={loading}
        />
      </div>

      <Panel padding="md">
        <div className="flex flex-wrap items-center gap-3">
          <Input
            inputSize="md"
            leadingIcon={<Search />}
            placeholder="Search experiments…"
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
            className="min-w-[160px]"
            options={[
              { value: 'all',       label: 'All statuses' },
              { value: 'draft',     label: 'Draft' },
              { value: 'running',   label: 'Running' },
              { value: 'paused',    label: 'Paused' },
              { value: 'completed', label: 'Completed' },
            ]}
          />
        </div>
      </Panel>

      {!loading && filtered.length === 0 ? (
        <Panel padding="none">
          <EmptyState
            icon={<FlaskConical />}
            kicker={search || statusFilter !== 'all' ? 'No matches' : 'Get started'}
            title={search || statusFilter !== 'all' ? 'No experiments match your filters' : 'No experiments yet'}
            description={
              search || statusFilter !== 'all'
                ? 'Try adjusting the filters.'
                : 'Run a controlled test to validate creative or targeting hypotheses.'
            }
            action={
              search || statusFilter !== 'all' ? (
                <Button variant="secondary" onClick={() => { setSearch(''); setStatusFilter('all'); }}>
                  Clear filters
                </Button>
              ) : (
                <Button variant="primary" leadingIcon={<Plus />} onClick={() => navigate('/experiments/new')}>
                  New experiment
                </Button>
              )
            }
          />
        </Panel>
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          rowKey={(it) => it.id}
          loading={loading}
          density="comfortable"
          onRowClick={(it) => navigate(`/experiments/${it.id}`)}
        />
      )}
    </div>
  );
}
