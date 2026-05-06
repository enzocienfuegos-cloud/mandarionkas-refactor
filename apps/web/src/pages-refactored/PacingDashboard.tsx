import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Gauge, AlertTriangle, TrendingUp, TrendingDown, RefreshCw } from '../system/icons';
import {
  Panel,
  PanelHeader,
  Button,
  Badge,
  Kicker,
  MetricCard,
  DataTable,
  type ColumnDef,
  EmptyState,
  useToast,
} from '../system';

type PacingHealth = 'on-track' | 'behind' | 'ahead' | 'at-risk';

interface PacingRow {
  campaignId: string;
  campaignName: string;
  client: string;
  goal: number;
  delivered: number;
  expected: number;
  health: PacingHealth;
  daysRemaining: number;
}

const HEALTH_TONE: Record<PacingHealth, 'success' | 'warning' | 'info' | 'critical'> = {
  'on-track': 'success',
  'behind':   'warning',
  'ahead':    'info',
  'at-risk':  'critical',
};

/**
 * Pacing dashboard — refactored to the design system (S56).
 */
export default function PacingDashboard() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [rows, setRows]       = useState<PacingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = React.useCallback(async (showSpinner: boolean) => {
    if (showSpinner) setLoading(true);
    else setRefreshing(true);

    try {
      const res = await fetch('/v1/pacing', { credentials: 'include' });
      if (!res.ok) throw new Error('failed');
      const data = await res.json();
      setRows(data?.items ?? []);
    } catch {
      toast({ tone: 'critical', title: 'Could not load pacing' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  useEffect(() => { void load(true); }, [load]);

  const summary = useMemo(() => {
    const onTrack = rows.filter((r) => r.health === 'on-track').length;
    const behind  = rows.filter((r) => r.health === 'behind' || r.health === 'at-risk').length;
    const ahead   = rows.filter((r) => r.health === 'ahead').length;
    const totalDelivered = rows.reduce((sum, r) => sum + r.delivered, 0);
    const totalExpected  = rows.reduce((sum, r) => sum + r.expected, 0);
    return {
      onTrack, behind, ahead,
      pacingIndex: totalExpected > 0 ? totalDelivered / totalExpected : 1,
    };
  }, [rows]);

  const columns: ColumnDef<PacingRow>[] = [
    {
      id: 'name',
      header: 'Campaign',
      width: '32%',
      sortAccessor: (row) => row.campaignName,
      cell: (row) => (
        <div className="min-w-0">
          <p className="font-medium text-[color:var(--dusk-text-primary)] truncate">{row.campaignName}</p>
          <p className="mt-0.5 text-xs text-[color:var(--dusk-text-soft)] truncate">{row.client}</p>
        </div>
      ),
    },
    {
      id: 'health',
      header: 'Health',
      sortAccessor: (row) => row.health,
      cell: (row) => <Badge tone={HEALTH_TONE[row.health]} dot>{row.health.replace('-', ' ')}</Badge>,
    },
    {
      id: 'delivered',
      header: 'Delivered',
      align: 'right',
      numeric: true,
      sortAccessor: (row) => row.delivered,
      cell: (row) => (
        <span>{row.delivered.toLocaleString()} <span className="text-[color:var(--dusk-text-soft)]">/ {row.goal.toLocaleString()}</span></span>
      ),
    },
    {
      id: 'pacing',
      header: 'Pacing',
      align: 'right',
      numeric: true,
      sortAccessor: (row) => (row.expected > 0 ? row.delivered / row.expected : 0),
      cell: (row) => {
        const ratio = row.expected > 0 ? row.delivered / row.expected : 0;
        const pct = Math.round(ratio * 100);
        return (
          <span className="inline-flex items-center gap-1.5">
            {ratio >= 0.95 && ratio <= 1.05 ? null : ratio < 0.95 ? (
              <TrendingDown className="h-3 w-3 text-[color:var(--dusk-status-warning-fg)]" />
            ) : (
              <TrendingUp className="h-3 w-3 text-[color:var(--dusk-status-info-fg)]" />
            )}
            <span className="dusk-mono text-xs">{pct}%</span>
          </span>
        );
      },
    },
    {
      id: 'days',
      header: 'Days left',
      align: 'right',
      numeric: true,
      sortAccessor: (row) => row.daysRemaining,
      cell: (row) => (
        <span className="text-[color:var(--dusk-text-secondary)]">
          {row.daysRemaining > 0 ? `${row.daysRemaining}d` : '—'}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <header className="dusk-page-header">
        <div>
          <Kicker>Pacing</Kicker>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[color:var(--dusk-text-primary)]">
            Delivery health
          </h1>
          <p className="mt-1 text-sm text-[color:var(--dusk-text-muted)]">
            Real-time pacing across all active campaigns.
          </p>
        </div>
        <Button
          variant="secondary"
          leadingIcon={<RefreshCw className={refreshing ? 'animate-spin' : undefined} />}
          loading={refreshing}
          onClick={() => void load(false)}
        >
          Refresh
        </Button>
      </header>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Pacing index"
          value={`${(summary.pacingIndex * 100).toFixed(0)}%`}
          tone={summary.pacingIndex >= 0.95 && summary.pacingIndex <= 1.05 ? 'success' : 'warning'}
          icon={<Gauge />}
          context="Delivered / expected across all campaigns"
          loading={loading}
        />
        <MetricCard
          label="On track"
          value={summary.onTrack}
          tone="success"
          icon={<TrendingUp />}
          loading={loading}
        />
        <MetricCard
          label="Behind"
          value={summary.behind}
          tone="warning"
          icon={<AlertTriangle />}
          loading={loading}
          onClick={summary.behind > 0 ? () => navigate('/pacing?filter=behind') : undefined}
        />
        <MetricCard
          label="Ahead"
          value={summary.ahead}
          tone="info"
          icon={<TrendingUp />}
          loading={loading}
        />
      </div>

      <Panel padding="none">
        {!loading && rows.length === 0 ? (
          <EmptyState
            icon={<Gauge />}
            title="No active campaigns to pace"
            description="Pacing is computed for active campaigns with a goal and flight dates."
          />
        ) : (
          <DataTable
            columns={columns}
            data={rows}
            rowKey={(r) => r.campaignId}
            loading={loading}
            density="comfortable"
            onRowClick={(r) => navigate(`/campaigns/${r.campaignId}`)}
            bordered={false}
          />
        )}
      </Panel>
    </div>
  );
}
