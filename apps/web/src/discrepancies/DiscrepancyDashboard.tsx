import React, { useEffect, useState, FormEvent } from 'react';
import { Panel, PrimaryButton, SectionKicker, StatusBadge } from '../shared/dusk-ui';

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
  const cfg: Record<Severity, { tone: 'healthy' | 'warning' | 'critical'; label: string }> = {
    ok:       { tone: 'healthy',  label: 'OK' },
    warning:  { tone: 'warning',  label: 'Warning' },
    critical: { tone: 'critical', label: 'Critical' },
  };
  const { tone, label } = cfg[severity] ?? { tone: 'warning' as const, label: severity };
  return <StatusBadge tone={tone}>{label}</StatusBadge>;
};

const KpiCard = ({ label, value, colorClass = 'text-slate-800' }: { label: string; value: string | number; colorClass?: string }) => (
  <Panel className="p-5">
    <p className="text-sm font-medium text-slate-500 dark:text-white/[0.48]">{label}</p>
    <p className={`mt-1 text-3xl font-bold ${colorClass}`}>{value}</p>
  </Panel>
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
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-fuchsia-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <Panel className="border-rose-200 bg-rose-50/90 p-4 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200">
        <p className="font-medium">Error loading discrepancies</p>
        <p className="text-sm mt-1">{error}</p>
        <button onClick={load} className="mt-3 text-sm text-red-600 underline">Retry</button>
      </Panel>
    );
  }

  return (
    <div className="space-y-6">
      <div className="dusk-page-header">
        <div>
          <SectionKicker>Reconciliation</SectionKicker>
          <h1 className="dusk-title mt-3">Discrepancy Reports</h1>
          <p className="dusk-copy mt-2">Monitor impression gaps between systems and control the thresholds that trigger operational alerts.</p>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <KpiCard label="Total Reports" value={summary?.totalReports ?? discrepancies.length} />
        <KpiCard label="Critical" value={summary?.criticalCount ?? 0} colorClass="text-red-700" />
        <KpiCard label="Warning" value={summary?.warningCount ?? 0} colorClass="text-yellow-700" />
      </div>

      {/* Filters */}
      <Panel className="mb-6 p-4">
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
          <PrimaryButton
            onClick={load}
          >
            Apply Filters
          </PrimaryButton>
        </div>
      </Panel>

      {/* Table */}
      {discrepancies.length === 0 ? (
        <Panel className="mb-6 px-6 py-16 text-center">
          <SectionKicker>No active gaps</SectionKicker>
          <h3 className="mt-3 text-lg font-medium text-slate-700 dark:text-white">No discrepancies found</h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-white/[0.56]">No reports match your current filters.</p>
        </Panel>
      ) : (
        <Panel className="mb-6 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="dusk-table-head">
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
                  <tr key={d.id} className="dusk-table-row transition-colors">
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
        </Panel>
      )}

      {/* Thresholds form */}
      <Panel className="p-6">
        <SectionKicker>Thresholds</SectionKicker>
        <h2 className="mb-4 mt-2 text-base font-semibold text-slate-800 dark:text-white">Alert Thresholds</h2>
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
          <PrimaryButton
            type="submit"
            disabled={savingThresholds}
          >
            {savingThresholds ? 'Saving...' : 'Save Thresholds'}
          </PrimaryButton>
          {thresholdMsg && (
            <span className={`text-sm ${thresholdMsg.includes('Failed') ? 'text-red-600' : 'text-green-600'}`}>
              {thresholdMsg}
            </span>
          )}
        </form>
        <p className="mt-3 text-xs text-slate-400">
          Discrepancies exceeding these percentages will trigger the corresponding alert level.
        </p>
      </Panel>
    </div>
  );
}
