import React, { useEffect, useState } from 'react';
import { Badge, Button, CenteredSpinner, EmptyState, Kicker, Panel } from '../system';

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

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <Kicker>Tags</Kicker>
          <h1 className="text-2xl font-bold text-text-primary mt-3">Tag Health</h1>
          <p className="text-sm text-text-muted mt-1">Real-time monitoring across all ad tags</p>
        </div>
        <Button onClick={load} variant="secondary">Refresh</Button>
      </div>

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
        <Panel className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-[color:var(--dusk-border-subtle)]">
              <caption className="sr-only">Tag health status, delivery recency, 24h impressions and error rate</caption>
              <thead className="bg-[color:var(--dusk-surface-muted)]">
                <tr>
                  {['Tag Name', 'Status', 'Last Impression', 'Imps (24h)', 'Error Rate'].map(h => (
                    <th key={h} scope="col" className="px-4 py-3 text-left text-xs font-semibold text-text-soft uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--dusk-border-subtle)]">
                {tags.map(t => (
                  <tr key={t.id} className="hover:bg-[color:var(--dusk-surface-muted)] transition-colors">
                    <th scope="row" className="px-4 py-3 text-left text-sm font-medium text-text-primary">{t.name}</th>
                    <td className="px-4 py-3">{statusBadge(t.status)}</td>
                    <td className="px-4 py-3 text-sm text-text-secondary">
                      {t.lastImpression
                        ? new Date(t.lastImpression).toLocaleString()
                        : <span className="text-text-soft italic">Never</span>
                      }
                    </td>
                    <td className="px-4 py-3 text-sm text-text-secondary font-medium">
                      {t.impressions24h.toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        tone={t.errorRate > 5 ? 'critical' : t.errorRate > 1 ? 'warning' : 'success'}
                        size="sm"
                      >
                        {t.errorRate.toFixed(2)}%
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </div>
  );
}
