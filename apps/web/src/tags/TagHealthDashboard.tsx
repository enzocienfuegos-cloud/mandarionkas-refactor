import React, { useEffect, useState } from 'react';

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
  const cfg: Record<TagHealth['status'], { cls: string; label: string }> = {
    healthy:  { cls: 'bg-green-100 text-green-800',  label: '✓ Healthy' },
    warning:  { cls: 'bg-yellow-100 text-yellow-800', label: '⚠ Warning' },
    critical: { cls: 'bg-red-100 text-red-800',      label: '✕ Critical' },
    unknown:  { cls: 'bg-slate-100 text-slate-600',  label: '? Unknown' },
  };
  const { cls, label } = cfg[status];
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
};

const KpiCard = ({
  label, value, colorClass,
}: { label: string; value: number; colorClass: string }) => (
  <div className="bg-white rounded-xl border border-slate-200 p-5">
    <p className="text-sm text-slate-500">{label}</p>
    <p className={`text-3xl font-bold mt-1 ${colorClass}`}>{value}</p>
  </div>
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
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        <p className="font-medium">Error loading tag health</p>
        <p className="text-sm mt-1">{error}</p>
        <button onClick={load} className="mt-3 text-sm text-red-600 underline">Retry</button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Tag Health</h1>
          <p className="text-sm text-slate-500 mt-1">Real-time monitoring across all ad tags</p>
        </div>
        <button
          onClick={load}
          className="px-4 py-2 text-sm border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
        >
          🔄 Refresh
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <KpiCard label="Healthy" value={summary?.healthy ?? 0} colorClass="text-green-600" />
        <KpiCard label="Warning" value={summary?.warning ?? 0} colorClass="text-yellow-600" />
        <KpiCard label="Critical" value={summary?.critical ?? 0} colorClass="text-red-600" />
        <KpiCard label="Unknown" value={summary?.unknown ?? 0} colorClass="text-slate-500" />
      </div>

      {/* Tags table */}
      {tags.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-slate-200">
          <p className="text-4xl mb-3">🩺</p>
          <h3 className="text-lg font-medium text-slate-700">No health data available</h3>
          <p className="text-sm text-slate-500 mt-1">Tag health data will appear once tags are active.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  {['Tag Name', 'Status', 'Last Impression', 'Imps (24h)', 'Error Rate'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tags.map(t => (
                  <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-slate-800">{t.name}</td>
                    <td className="px-4 py-3">{statusBadge(t.status)}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {t.lastImpression
                        ? new Date(t.lastImpression).toLocaleString()
                        : <span className="text-slate-400 italic">Never</span>
                      }
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700 font-medium">
                      {t.impressions24h.toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-sm font-medium ${
                        t.errorRate > 5 ? 'text-red-600' : t.errorRate > 1 ? 'text-yellow-600' : 'text-green-600'
                      }`}>
                        {t.errorRate.toFixed(2)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
