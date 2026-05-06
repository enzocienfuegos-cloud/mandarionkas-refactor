import React, { useEffect, useState, FormEvent } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  Button,
  CenteredSpinner,
  EmptyState,
  FormField,
  Input,
  Kicker,
  Panel,
  Select,
} from '../system';

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
      <Panel className="p-6">
        <Kicker>Compliance</Kicker>
        <h1 className="mt-2 text-2xl font-bold text-[color:var(--dusk-text-primary)]">Audit Log</h1>
        <p className="mt-2 text-sm text-[color:var(--dusk-status-warning-fg)]">
          This workspace account does not currently include permission to inspect audit events.
        </p>
      </Panel>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <Kicker>Compliance</Kicker>
        <h1 className="mt-2 text-2xl font-bold text-[color:var(--dusk-text-primary)]">Audit Log</h1>
        <p className="mt-1 text-sm text-[color:var(--dusk-text-muted)]">
          Track all actions performed in your workspace.
        </p>
      </div>

      <Panel className="mb-6 p-5">
        <form onSubmit={handleApplyFilters} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <FormField label="Action" htmlFor="audit-action">
            <Input
              id="audit-action"
              type="text"
              value={pendingFilters.action}
              onChange={setF('action')}
              placeholder="e.g. campaign.created"
            />
          </FormField>
          <FormField label="Actor Email" htmlFor="audit-actor-email">
            <Input
              id="audit-actor-email"
              type="email"
              value={pendingFilters.actorEmail}
              onChange={setF('actorEmail')}
              placeholder="user@example.com"
            />
          </FormField>
          <FormField label="Resource Type" htmlFor="audit-resource-type">
            <Select
              id="audit-resource-type"
              value={pendingFilters.resourceType}
              onChange={setF('resourceType')}
            >
              {RESOURCE_TYPES.map(t => (
                <option key={t} value={t}>{t === 'all' ? 'All Types' : t}</option>
              ))}
            </Select>
          </FormField>
          <FormField label="Date From" htmlFor="audit-date-from">
            <Input
              id="audit-date-from"
              type="date"
              value={pendingFilters.dateFrom}
              onChange={setF('dateFrom')}
            />
          </FormField>
          <FormField label="Date To" htmlFor="audit-date-to">
            <Input
              id="audit-date-to"
              type="date"
              value={pendingFilters.dateTo}
              onChange={setF('dateTo')}
            />
          </FormField>
          <div className="flex items-end gap-2">
            <Button type="submit" className="flex-1">
              Apply
            </Button>
            <Button type="button" variant="secondary" onClick={handleResetFilters}>
              Reset
            </Button>
          </div>
        </form>
      </Panel>

      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-[color:var(--dusk-text-muted)]">
          {total > 0 ? `${total.toLocaleString()} event${total !== 1 ? 's' : ''}` : ''}
        </p>
        {totalPages > 1 && (
          <p className="text-sm text-[color:var(--dusk-text-muted)]">Page {currentPage} of {totalPages}</p>
        )}
      </div>

      {loading ? (
        <CenteredSpinner label="Loading audit events" />
      ) : error ? (
        <Panel className="p-4" role="alert">
          <p className="font-medium text-[color:var(--dusk-status-critical-fg)]">Error loading audit log</p>
          <p className="mt-1 text-sm text-[color:var(--dusk-text-muted)]">{error}</p>
          <div className="mt-4">
            <Button variant="secondary" onClick={() => load(offset)}>
              Retry
            </Button>
          </div>
        </Panel>
      ) : events.length === 0 ? (
        <EmptyState
          kicker="No events"
          title="No audit events found"
          description="Try adjusting your filters to widen the time range or resource scope."
        />
      ) : (
        <Panel className="overflow-hidden" padding="none">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-[color:var(--dusk-border-subtle)]">
              <caption className="sr-only">
                Workspace audit events with actor, action, resource, and event details.
              </caption>
              <thead className="bg-[color:var(--dusk-surface-muted)]">
                <tr>
                  {['Timestamp', 'Actor', 'Action', 'Resource', 'ID', ''].map((h, i) => (
                    <th
                      key={i}
                      scope="col"
                      className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[color:var(--dusk-text-soft)]"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--dusk-border-subtle)]">
                {events.map(ev => (
                  <React.Fragment key={ev.id}>
                    <tr
                      className="cursor-pointer transition-colors hover:bg-[color:var(--dusk-surface-muted)]"
                      onClick={() => setExpandedId(expandedId === ev.id ? null : ev.id)}
                    >
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-[color:var(--dusk-text-muted)]">
                        {new Date(ev.timestamp).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-sm text-[color:var(--dusk-text-secondary)]">{ev.actorEmail}</td>
                      <td className="px-4 py-3">
                        <code className="rounded bg-[color:var(--dusk-surface-muted)] px-1.5 py-0.5 text-xs font-mono text-[color:var(--dusk-text-secondary)]">
                          {ev.action}
                        </code>
                      </td>
                      <td className="px-4 py-3 text-sm capitalize text-[color:var(--dusk-text-muted)]">{ev.resourceType}</td>
                      <th scope="row" className="px-4 py-3 text-left">
                        <code className="text-xs font-mono text-[color:var(--dusk-text-muted)]">{ev.resourceId}</code>
                      </th>
                      <td className="px-4 py-3 text-xs text-[color:var(--dusk-text-soft)]">
                        {ev.metadata && Object.keys(ev.metadata).length > 0 && (
                          <span>{expandedId === ev.id ? '▲' : '▼'} details</span>
                        )}
                      </td>
                    </tr>
                    {expandedId === ev.id && ev.metadata && Object.keys(ev.metadata).length > 0 && (
                      <tr>
                        <td
                          colSpan={6}
                          className="border-b border-[color:var(--dusk-border-subtle)] bg-[color:var(--dusk-surface-muted)] px-4 py-3"
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex-1">
                              <p className="mb-2 text-xs font-semibold text-[color:var(--dusk-text-soft)]">Metadata</p>
                              <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg bg-[color:var(--dusk-surface-inverse)] p-3 text-xs font-mono text-[color:var(--dusk-text-inverse)]">
                                {JSON.stringify(ev.metadata, null, 2)}
                              </pre>
                            </div>
                            {ev.ipAddress && (
                              <div>
                                <p className="mb-1 text-xs font-semibold text-[color:var(--dusk-text-soft)]">IP Address</p>
                                <code className="text-xs font-mono text-[color:var(--dusk-text-muted)]">{ev.ipAddress}</code>
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
        </Panel>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <Button
            variant="secondary"
            onClick={() => load(offset - LIMIT)}
            disabled={offset === 0 || loading}
          >
            ← Previous
          </Button>
          <span className="px-4 py-2 text-sm text-[color:var(--dusk-text-muted)]">
            {currentPage} / {totalPages}
          </span>
          <Button
            variant="secondary"
            onClick={() => load(offset + LIMIT)}
            disabled={offset + LIMIT >= total || loading}
          >
            Next →
          </Button>
        </div>
      )}
    </div>
  );
}
