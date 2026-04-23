import React, { useEffect, useState, FormEvent } from 'react';

type Severity = 'ok' | 'warning' | 'critical';

interface Discrepancy {
  id: string;
  tagId: string;
  tagName: string;
  date: string;
  source: string;
  servedImpressions: number;
  reportedImpressions: number;
  deltaPct: number;
  severity: Severity;
}

interface DiscrepancySummary {
  totalReports: number;
  criticalCount: number;
  warningCount: number;
}

interface Thresholds {
  warningPct: number;
  criticalPct: number;
}

interface Filters {
  dateFrom: string;
  dateTo: string;
  severity: string;
}

const severityBadge = (severity: Severity) => {
  const cfg: Record<Severity, { cls: string; label: string }> = {
    ok:       { cls: 'bg-green-100 text-green-800',   label: 'OK' },
    warning:  { cls: 'bg-yellow-100 text-yellow-800', label: 'Warning' },
    critical: { cls: 'bg-red-100 text-red-800',       label: 'Critical' },
  };
  const { cls, label } = cfg[severity] ?? { cls: 'bg-slate-100 text-slate-600', label: severity };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
};

const KpiCard = ({ label, value, colorClass = 'text-slate-800' }: { label: string; value: string | number; colorClass?: string }) => (
  <div className="bg-white rounded-xl border border-slate-200 p-5">
    <p className="text-sm text-slate-500 font-medium">{label}</p>
    <p className={`text-3xl font-bold mt-1 ${colorClass}`}>{value}</p>
  </div>
);

export default function DiscrepancyDashboard() {
  const [discrepancies, setDiscrepancies] = useState<Discrepancy[]>([]);
  const [summary, setSummary] = useState<DiscrepancySummary | null>(null);
  const [thresholds, setThresholds] = useState<Thresholds>({ warningPct: 5, criticalPct: 15 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingThresholds, setSavingThresholds] = useState(false);
  const [thresholdMsg, setThresholdMsg] = useState('');

  const today = new Date().toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);

  const [filters, setFilters] = useState<Filters>({
    dateFrom: thirtyDaysAgo,
    dateTo: today,
    severity: 'all',
  });

  const setFilter = (k: keyof Filters) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setFilters(f => ({ ...f, [k]: e.target.value }));

  const load = () => {
    setLoading(true);
    setError('');
    const params = new URLSearchParams();
    if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
    if (filters.dateTo) params.set('dateTo', filters.dateTo);
    if (filters.severity !== 'all') params.set('severity', filters.severity);

    Promise.all([
      fetch(`/v1/discrepancies?${params}`, { credentials: 'include' }).then(r => { if (!r.ok) throw new Error('Failed to load'); return r.json(); }),
      fetch('/v1/discrepancies/summary', { credentials: 'include' }).then(r => r.json()).catch(() => null),
      fetch('/v1/discrepancies/thresholds', { credentials: 'include' }).then(r => r.json()).catch(() => null),
    ])
      .then(([discData, summData, thrData]) => {
        setDiscrepancies(discData?.reports ?? discData?.discrepancies ?? discData ?? []);
        if (summData) setSummary(summData?.summary ?? summData);
        if (thrData) setThresholds(thrData?.thresholds ?? thrData);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleSaveThresholds = async (e: FormEvent) => {
    e.preventDefault();
    setSavingThresholds(true);
    setThresholdMsg('');
    try {
      const res = await fetch('/v1/discrepancies/thresholds', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(thresholds),
      });
      if (!res.ok) throw new Error('Save failed');
      setThresholdMsg('Thresholds saved successfully.');
    } catch {
      setThresholdMsg('Failed to save thresholds.');
    } finally {
      setSavingThresholds(false);
    }
  };

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
        <p className="font-medium">Error loading discrepancies</p>
        <p className="text-sm mt-1">{error}</p>
        <button onClick={load} className="mt-3 text-sm text-red-600 underline">Retry</button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Discrepancy Reports</h1>
          <p className="text-sm text-slate-500 mt-1">Impression count differences between systems</p>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <KpiCard label="Total Reports" value={summary?.totalReports ?? discrepancies.length} />
        <KpiCard label="Critical" value={summary?.criticalCount ?? 0} colorClass="text-red-700" />
        <KpiCard label="Warning" value={summary?.warningCount ?? 0} colorClass="text-yellow-700" />
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Date From</label>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={setFilter('dateFrom')}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Date To</label>
            <input
              type="date"
              value={filters.dateTo}
              onChange={setFilter('dateTo')}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Severity</label>
            <select
              value={filters.severity}
              onChange={setFilter('severity')}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All</option>
              <option value="ok">OK</option>
              <option value="warning">Warning</option>
              <option value="critical">Critical</option>
            </select>
          </div>
          <button
            onClick={load}
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Apply Filters
          </button>
        </div>
      </div>

      {/* Table */}
      {discrepancies.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-slate-200 mb-6">
          <p className="text-4xl mb-3">⚠️</p>
          <h3 className="text-lg font-medium text-slate-700">No discrepancies found</h3>
          <p className="text-sm text-slate-500 mt-1">No reports match your current filters.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden mb-6">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  {['Tag', 'Date', 'Source', 'Served', 'Reported', 'Delta', 'Severity'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {discrepancies.map(d => (
                  <tr key={d.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-slate-800">{d.tagName}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{new Date(d.date).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{d.source}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{d.servedImpressions.toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{d.reportedImpressions.toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <span className={`text-sm font-medium ${
                        Math.abs(d.deltaPct) > 10 ? 'text-red-600' : Math.abs(d.deltaPct) > 5 ? 'text-yellow-600' : 'text-green-600'
                      }`}>
                        {d.deltaPct > 0 ? '+' : ''}{d.deltaPct.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-4 py-3">{severityBadge(d.severity)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Thresholds form */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-base font-semibold text-slate-800 mb-4">Alert Thresholds</h2>
        <form onSubmit={handleSaveThresholds} className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Warning Threshold (%)</label>
            <input
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={thresholds.warningPct}
              onChange={e => setThresholds(t => ({ ...t, warningPct: Number(e.target.value) }))}
              className="w-32 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Critical Threshold (%)</label>
            <input
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={thresholds.criticalPct}
              onChange={e => setThresholds(t => ({ ...t, criticalPct: Number(e.target.value) }))}
              className="w-32 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <button
            type="submit"
            disabled={savingThresholds}
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            {savingThresholds ? 'Saving...' : 'Save Thresholds'}
          </button>
          {thresholdMsg && (
            <span className={`text-sm ${thresholdMsg.includes('Failed') ? 'text-red-600' : 'text-green-600'}`}>
              {thresholdMsg}
            </span>
          )}
        </form>
        <p className="mt-3 text-xs text-slate-400">
          Discrepancies exceeding these percentages will trigger the corresponding alert level.
        </p>
      </div>
    </div>
  );
}
