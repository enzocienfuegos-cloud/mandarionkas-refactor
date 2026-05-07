import React, { useEffect, useMemo, useState } from 'react';
import { Badge, Button, CenteredSpinner, DataTable, EmptyState, Kicker, PageHeader, Panel, type ColumnDef } from '../system';

interface TagHealth {
  id: string;
  name: string;
  status: 'healthy' | 'warning' | 'critical' | 'unknown';
  lastImpression: string | null;
  impressions24h: number;
  errorRate: number;
}

interface HealthSummary {
  healthy: number;
  warning: number;
  critical: number;
  unknown: number;
}

const statusBadge = (status: TagHealth['status']) => {
  const cfg: Record<TagHealth['status'], { tone: 'success' | 'warning' | 'critical' | 'neutral'; label: string }> = {
    healthy: { tone: 'success', label: 'Healthy' },
    warning: { tone: 'warning', label: 'Warning' },
    critical: { tone: 'critical', label: 'Critical' },
    unknown: { tone: 'neutral', label: 'Unknown' },
  };
  const { tone, label } = cfg[status];
  return <Badge tone={tone}>{label}</Badge>;
};

const KpiCard = ({
  label, value, tone,
}: { label: string; value: number; tone: 'success' | 'warning' | 'critical' | 'neutral' }) => (
  <Panel className="p-5">
    <p className="text-sm text-text-muted">{label}</p>
    <p className="mt-1 text-3xl font-bold text-text-primary">{value}</p>
    <div className="mt-3">
      <Badge tone={tone} size="sm">{label}</Badge>
    </div>
  </Panel>
);

export default function TagHealthDashboard() {
  const [tags, setTags] = useState<TagHealth[]>([]);
  const [summary, setSummary] = useState<HealthSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    setError('');
    Promise.all([
      fetch('/v1/tags/health', { credentials: 'include' }).then(r => { if (!r.ok) throw new Error('Health fetch failed'); return r.json(); }),
      fetch('/v1/tags/health/summary', { credentials: 'include' }).then(r => { if (!r.ok) throw new Error('Summary fetch failed'); return r.json(); }),
    ])
      .then(([healthData, summaryData]) => {
        setTags(healthData?.tags ?? healthData ?? []);
        setSummary(summaryData);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  if (loading) {
    return <CenteredSpinner label="Loading tag health…" />;
  }

  if (error) {
    return (
      <Panel className="border-[color:var(--dusk-status-critical-border)] bg-[color:var(--dusk-status-critical-bg)] p-4 text-[color:var(--dusk-status-critical-fg)]">
        <p className="font-medium">Error loading tag health</p>
        <p className="text-sm mt-1">{error}</p>
        <Button onClick={load} variant="ghost" size="sm" className="mt-3">Retry</Button>
      </Panel>
    );
  }

  const columns = useMemo<ColumnDef<TagHealth>[]>(() => [
    {
      id: 'name',
      header: 'Tag Name',
      cell: (tag) => tag.name,
      sortAccessor: (tag) => tag.name,
    },
    {
      id: 'status',
      header: 'Status',
      cell: (tag) => statusBadge(tag.status),
      sortAccessor: (tag) => tag.status,
    },
    {
      id: 'lastImpression',
      header: 'Last Impression',
      cell: (tag) => tag.lastImpression ? new Date(tag.lastImpression).toLocaleString() : <span className="italic text-text-soft">Never</span>,
      sortAccessor: (tag) => tag.lastImpression ?? '',
    },
    {
      id: 'impressions24h',
      header: 'Imps (24h)',
      align: 'right',
      numeric: true,
      cell: (tag) => tag.impressions24h.toLocaleString(),
      sortAccessor: (tag) => tag.impressions24h,
    },
    {
      id: 'errorRate',
      header: 'Error Rate',
      align: 'right',
      numeric: true,
      cell: (tag) => (
        <Badge tone={tag.errorRate > 5 ? 'critical' : tag.errorRate > 1 ? 'warning' : 'success'} size="sm">
          {tag.errorRate.toFixed(2)}%
        </Badge>
      ),
      sortAccessor: (tag) => tag.errorRate,
    },
  ], []);

  return (
    <div>
      <PageHeader
        kicker="Tags"
        title="Tag Health"
        meta={`${tags.length} tags monitored · real-time delivery health across the workspace`}
        secondaryActions={<Button onClick={load} variant="secondary">Refresh</Button>}
      />

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <KpiCard label="Healthy" value={summary?.healthy ?? 0} tone="success" />
        <KpiCard label="Warning" value={summary?.warning ?? 0} tone="warning" />
        <KpiCard label="Critical" value={summary?.critical ?? 0} tone="critical" />
        <KpiCard label="Unknown" value={summary?.unknown ?? 0} tone="neutral" />
      </div>

      {/* Tags table */}
      {tags.length === 0 ? (
        <Panel className="py-20">
          <EmptyState
            title="No health data available"
            description="Tag health data will appear once tags are active."
          />
        </Panel>
      ) : (
        <DataTable
          columns={columns}
          data={tags}
          rowKey={(tag) => tag.id}
          bordered
        />
      )}
    </div>
  );
}
