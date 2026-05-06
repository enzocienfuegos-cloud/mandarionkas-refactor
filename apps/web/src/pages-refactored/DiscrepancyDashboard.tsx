import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, AlertCircle, RefreshCw, ExternalLink } from '../system/icons';
import {
  Panel,
  Button,
  Badge,
  Kicker,
  MetricCard,
  DataTable,
  type ColumnDef,
  EmptyState,
  useToast,
} from '../system';

type DiscrepancySeverity = 'low' | 'medium' | 'high' | 'critical';

interface Discrepancy {
  id: string;
  campaignId: string;
  campaignName: string;
  source: 'adserver' | 'dsp' | 'verifier';
  metric: 'impressions' | 'clicks' | 'spend';
  adserverValue: number;
  externalValue: number;
  variance: number;
  severity: DiscrepancySeverity;
  detectedAt: string;
}

const SEVERITY_TONE: Record<DiscrepancySeverity, 'neutral' | 'warning' | 'critical'> = {
  low:      'neutral',
  medium:   'warning',
  high:     'warning',
  critical: 'critical',
};

/**
 * Discrepancy dashboard — refactored to the design system (S56).
 */
export default function DiscrepancyDashboard() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [items, setItems]     = useState<Discrepancy[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = React.useCallback(async (showSpinner: boolean) => {
    if (showSpinner) setLoading(true);
    else setRefreshing(true);

    try {
      const res = await fetch('/v1/discrepancies', { credentials: 'include' });
      if (!res.ok) throw new Error('failed');
      const data = await res.json();
      setItems(data?.items ?? []);
    } catch {
      toast({ tone: 'critical', title: 'Could not load discrepancies' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  useEffect(() => { void load(true); }, [load]);

  const summary = useMemo(() => {
    const critical = items.filter((d) => d.severity === 'critical').length;
    const high     = items.filter((d) => d.severity === 'high').length;
    const total    = items.length;
    const avgVariance = items.length
      ? items.reduce((sum, d) => sum + Math.abs(d.variance), 0) / items.length
      : 0;
    return { critical, high, total, avgVariance };
  }, [items]);

  const columns: ColumnDef<Discrepancy>[] = [
    {
      id: 'campaign',
      header: 'Campaign',
      width: '28%',
      sortAccessor: (row) => row.campaignName,
      cell: (row) => (
        <p className="font-medium text-[color:var(--dusk-text-primary)] truncate">{row.campaignName}</p>
      ),
    },
    {
      id: 'source',
      header: 'Source',
      sortAccessor: (row) => row.source,
      cell: (row) => (
        <Badge tone="neutral" size="sm" variant="outline">
          {row.source.toUpperCase()}
        </Badge>
      ),
    },
    {
      id: 'metric',
      header: 'Metric',
      sortAccessor: (row) => row.metric,
      cell: (row) => (
        <span className="text-[color:var(--dusk-text-secondary)] capitalize">{row.metric}</span>
      ),
    },
    {
      id: 'adserver',
      header: 'Ad server',
      align: 'right',
      numeric: true,
      sortAccessor: (row) => row.adserverValue,
      cell: (row) => row.adserverValue.toLocaleString(),
    },
    {
      id: 'external',
      header: 'External',
      align: 'right',
      numeric: true,
      sortAccessor: (row) => row.externalValue,
      cell: (row) => row.externalValue.toLocaleString(),
    },
    {
      id: 'variance',
      header: 'Variance',
      align: 'right',
      numeric: true,
      sortAccessor: (row) => Math.abs(row.variance),
      cell: (row) => {
        const pct = (row.variance * 100).toFixed(1);
        const sign = row.variance > 0 ? '+' : '';
        return (
          <span
            className="dusk-mono text-xs font-medium"
            style={{
              color:
                Math.abs(row.variance) > 0.10
                  ? 'var(--dusk-status-critical-fg)'
                  : Math.abs(row.variance) > 0.03
                  ? 'var(--dusk-status-warning-fg)'
                  : 'var(--dusk-text-secondary)',
            }}
          >
            {sign}{pct}%
          </span>
        );
      },
    },
    {
      id: 'severity',
      header: 'Severity',
      sortAccessor: (row) => row.severity,
      cell: (row) => <Badge tone={SEVERITY_TONE[row.severity]} dot size="sm">{row.severity}</Badge>,
    },
    {
      id: 'actions',
      header: '',
      align: 'right',
      cell: (row) => (
        <Button
          size="sm"
          variant="ghost"
          trailingIcon={<ExternalLink />}
          onClick={(e) => { e.stopPropagation(); navigate(`/campaigns/${row.campaignId}`); }}
        >
          Open
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <header className="dusk-page-header">
        <div>
          <Kicker>Discrepancies</Kicker>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[color:var(--dusk-text-primary)]">
            Reconciliation alerts
          </h1>
          <p className="mt-1 text-sm text-[color:var(--dusk-text-muted)]">
            Mismatches between ad server, DSP and verification partners.
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
          label="Total alerts"
          value={summary.total}
          tone="neutral"
          icon={<AlertTriangle />}
          loading={loading}
        />
        <MetricCard
          label="Critical"
          value={summary.critical}
          tone="critical"
          icon={<AlertCircle />}
          loading={loading}
        />
        <MetricCard
          label="High severity"
          value={summary.high}
          tone="warning"
          icon={<AlertTriangle />}
          loading={loading}
        />
        <MetricCard
          label="Avg variance"
          value={`${(summary.avgVariance * 100).toFixed(1)}%`}
          tone={summary.avgVariance > 0.10 ? 'critical' : summary.avgVariance > 0.03 ? 'warning' : 'success'}
          context="Across all open discrepancies"
          loading={loading}
        />
      </div>

      <Panel padding="none">
        {!loading && items.length === 0 ? (
          <EmptyState
            icon={<AlertTriangle />}
            kicker="All clear"
            title="No discrepancies detected"
            description="When metrics from your ad server diverge from DSP or verifier reports by more than the configured threshold, alerts will appear here."
          />
        ) : (
          <DataTable
            columns={columns}
            data={items}
            rowKey={(d) => d.id}
            loading={loading}
            density="comfortable"
            bordered={false}
          />
        )}
      </Panel>
    </div>
  );
}
