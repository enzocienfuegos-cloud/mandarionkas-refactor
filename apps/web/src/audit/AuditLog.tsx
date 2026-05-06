import React, { useEffect, useState, FormEvent } from 'react';
import { useOutletContext } from 'react-router-dom';

interface AuditEvent {
  id: string;
  timestamp: string;
  actorEmail: string;
  action: string;
  resourceType: string;
  resourceId: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
}

interface AuditResponse {
  events: AuditEvent[];
  total: number;
  offset: number;
  limit: number;
}

const RESOURCE_TYPES = [
  'all', 'campaign', 'tag', 'creative', 'team', 'api_key',
  'webhook', 'workspace', 'auth', 'experiment',
];

const LIMIT = 50;

export default function AuditLog() {
  const { user } = useOutletContext<{ user?: { permissions?: string[] } }>();
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [filters, setFilters] = useState({
    action: '',
    actorEmail: '',
    resourceType: 'all',
    dateFrom: '',
    dateTo: '',
  });
  const [pendingFilters, setPendingFilters] = useState({ ...filters });
  const canReadAudit = Boolean(user?.permissions?.includes('audit:read'));

  const setF = (k: keyof typeof pendingFilters) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => setPendingFilters(f => ({ ...f, [k]: e.target.value }));

  const load = (off = 0) => {
    setLoading(true);
    setError('');
    const params = new URLSearchParams();
    params.set('limit', String(LIMIT));
    params.set('offset', String(off));
    if (filters.action) params.set('action', filters.action);
    if (filters.actorEmail) params.set('actorEmail', filters.actorEmail);
    if (filters.resourceType !== 'all') params.set('resourceType', filters.resourceType);
    if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
    if (filters.dateTo) params.set('dateTo', filters.dateTo);

    fetch(`/v1/audit?${params}`, { credentials: 'include' })
      .then(r => { if (!r.ok) throw new Error('Failed to load audit log'); return r.json() as Promise<AuditResponse>; })
      .then(d => {
        setEvents(d?.events ?? []);
        setTotal(d?.total ?? 0);
        setOffset(off);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (canReadAudit) load(0);
  }, [canReadAudit, filters]);

  const handleApplyFilters = (e: FormEvent) => {
    e.preventDefault();
    setFilters({ ...pendingFilters });
  };

  const handleResetFilters = () => {
    const empty = { action: '', actorEmail: '', resourceType: 'all', dateFrom: '', dateTo: '' };
    setPendingFilters(empty);
    setFilters(empty);
  };

  const totalPages = Math.ceil(total / LIMIT);
  const currentPage = Math.floor(offset / LIMIT) + 1;

  if (!canReadAudit) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
        <h1 className="text-2xl font-bold">Audit Log</h1>
        <p className="mt-2 text-sm">
          This workspace account does not currently include permission to inspect audit events.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Audit Log</h1>
        <p className="text-sm text-slate-500 mt-1">Track all actions performed in your workspace</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 mb-6">
        <form onSubmit={handleApplyFilters} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Action</label>
            <input
              type="text"
              value={pendingFilters.action}
              onChange={setF('action')}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-fuchsia-500"
              placeholder="e.g. campaign.created"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Actor Email</label>
            <input
              type="email"
              value={pendingFilters.actorEmail}
              onChange={setF('actorEmail')}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-fuchsia-500"
              placeholder="user@example.com"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Resource Type</label>
            <select
              value={pendingFilters.resourceType}
              onChange={setF('resourceType')}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-fuchsia-500"
            >
              {RESOURCE_TYPES.map(t => (
                <option key={t} value={t}>{t === 'all' ? 'All Types' : t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Date From</label>
            <input
              type="date"
              value={pendingFilters.dateFrom}
              onChange={setF('dateFrom')}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-fuchsia-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Date To</label>
            <input
              type="date"
              value={pendingFilters.dateTo}
              onChange={setF('dateTo')}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-fuchsia-500"
            />
          </div>
          <div className="flex items-end gap-2">
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-brand-gradient text-white text-sm font-medium rounded-lg transition-colors hover:opacity-95"
            >
              Apply
            </button>
            <button
              type="button"
              onClick={handleResetFilters}
              className="px-4 py-2 border border-slate-300 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors"
            >
              Reset
            </button>
          </div>
        </form>
      </div>

      {/* Results count */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-slate-500">
          {total > 0 ? `${total.toLocaleString()} event${total !== 1 ? 's' : ''}` : ''}
        </p>
        {totalPages > 1 && (
          <p className="text-sm text-slate-500">Page {currentPage} of {totalPages}</p>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-fuchsia-500"></div>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          <p className="font-medium">Error loading audit log</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      ) : events.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
          <h3 className="text-lg font-medium text-slate-700">No audit events found</h3>
          <p className="text-sm text-slate-500 mt-1">Try adjusting your filters.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  {['Timestamp', 'Actor', 'Action', 'Resource', 'ID', ''].map((h, i) => (
                    <th key={i} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {events.map(ev => (
                  <React.Fragment key={ev.id}>
                    <tr
                      className="hover:bg-slate-50 transition-colors cursor-pointer"
                      onClick={() => setExpandedId(expandedId === ev.id ? null : ev.id)}
                    >
                      <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                        {new Date(ev.timestamp).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">{ev.actorEmail}</td>
                      <td className="px-4 py-3">
                        <code className="text-xs font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">
                          {ev.action}
                        </code>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 capitalize">{ev.resourceType}</td>
                      <td className="px-4 py-3">
                        <code className="text-xs font-mono text-slate-500">{ev.resourceId}</code>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400">
                        {ev.metadata && Object.keys(ev.metadata).length > 0 && (
                          <span>{expandedId === ev.id ? '▲' : '▼'} details</span>
                        )}
                      </td>
                    </tr>
                    {expandedId === ev.id && ev.metadata && Object.keys(ev.metadata).length > 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-3 bg-slate-50 border-b border-slate-100">
                          <div className="flex items-start gap-3">
                            <div className="flex-1">
                              <p className="text-xs font-semibold text-slate-500 mb-2">Metadata</p>
                              <pre className="text-xs font-mono bg-slate-900 text-slate-100 p-3 rounded-lg overflow-x-auto whitespace-pre-wrap">
                                {JSON.stringify(ev.metadata, null, 2)}
                              </pre>
                            </div>
                            {ev.ipAddress && (
                              <div>
                                <p className="text-xs font-semibold text-slate-500 mb-1">IP Address</p>
                                <code className="text-xs font-mono text-slate-600">{ev.ipAddress}</code>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <button
            onClick={() => load(offset - LIMIT)}
            disabled={offset === 0 || loading}
            className="px-4 py-2 text-sm border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ← Previous
          </button>
          <span className="px-4 py-2 text-sm text-slate-600">
            {currentPage} / {totalPages}
          </span>
          <button
            onClick={() => load(offset + LIMIT)}
            disabled={offset + LIMIT >= total || loading}
            className="px-4 py-2 text-sm border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
