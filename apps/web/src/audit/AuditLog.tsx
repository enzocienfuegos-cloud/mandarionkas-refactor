import React, { FormEvent, useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  Button,
  CenteredSpinner,
  DataTable,
  EmptyState,
  FormField,
  Input,
  Kicker,
  PageHeader,
  Panel,
  Select,
  type ColumnDef,
} from '../system';
import { useAuditData, useAuditFilters } from './hooks';

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
  const {
    filters,
    setFilters,
    pendingFilters,
    setPendingFilters,
    resetFilters: handleResetFilters,
  } = useAuditFilters();
  const canReadAudit = Boolean(user?.permissions?.includes('audit:read'));
  const {
    events,
    total,
    offset,
    loading,
    error,
    expandedId,
    setExpandedId,
    load,
  } = useAuditData({ canReadAudit, filters });

  const setF = (k: keyof typeof pendingFilters) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => setPendingFilters((f) => ({ ...f, [k]: e.target.value }));

  const handleApplyFilters = (event: FormEvent) => {
    event.preventDefault();
    setFilters({ ...pendingFilters });
  };

  const totalPages = Math.ceil(total / LIMIT);
  const currentPage = Math.floor(offset / LIMIT) + 1;
  const expandedEvent = events.find((item) => item.id === expandedId) ?? null;

  const columns: ColumnDef<AuditEvent>[] = [
    {
      id: 'timestamp',
      header: 'Timestamp',
      sortAccessor: (item) => item.timestamp,
      cell: (item) => <span className="text-xs text-text-muted">{new Date(item.timestamp).toLocaleString()}</span>,
    },
    {
      id: 'actor',
      header: 'Actor',
      sortAccessor: (item) => item.actorEmail,
      cell: (item) => <span className="text-sm text-text-secondary">{item.actorEmail}</span>,
    },
    {
      id: 'action',
      header: 'Action',
      sortAccessor: (item) => item.action,
      cell: (item) => (
        <code className="rounded bg-[color:var(--dusk-surface-muted)] px-1.5 py-0.5 text-xs font-mono text-text-secondary">
          {item.action}
        </code>
      ),
    },
    {
      id: 'resource',
      header: 'Resource',
      sortAccessor: (item) => item.resourceType,
      cell: (item) => <span className="text-sm capitalize text-text-muted">{item.resourceType}</span>,
    },
    {
      id: 'resource-id',
      header: 'ID',
      sortAccessor: (item) => item.resourceId,
      cell: (item) => <code className="text-xs font-mono text-text-muted">{item.resourceId}</code>,
    },
    {
      id: 'details',
      header: 'Details',
      cell: (item) => (
        item.metadata && Object.keys(item.metadata).length > 0
          ? <span className="text-xs text-text-soft">{expandedId === item.id ? 'Hide details' : 'View details'}</span>
          : <span className="text-xs text-text-soft">No metadata</span>
      ),
    },
  ];

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
      <PageHeader
        kicker="Compliance"
        title="Audit Log"
        meta={`${total.toLocaleString()} events in scope · filter by actor, action, resource or date`}
      />

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
              {RESOURCE_TYPES.map((type) => (
                <option key={type} value={type}>{type === 'all' ? 'All Types' : type}</option>
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
            <Button type="submit" className="flex-1">Apply</Button>
            <Button type="button" variant="secondary" onClick={handleResetFilters}>Reset</Button>
          </div>
        </form>
      </Panel>

      <div className="mb-3 flex items-center justify-between">
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
        <Panel className="p-4" role="status" aria-live="polite">
          <p className="font-medium text-[color:var(--dusk-status-critical-fg)]">Couldn&apos;t load audit events</p>
          <p className="mt-1 text-sm text-[color:var(--dusk-text-muted)]">
            Check the selected date range or resource scope, then retry. Details: {error}
          </p>
          <div className="mt-4">
            <Button variant="secondary" onClick={() => load(offset)}>Retry</Button>
          </div>
        </Panel>
      ) : events.length === 0 ? (
        <EmptyState
          kicker="No events"
          title="No audit events found"
          description="Try adjusting your filters to widen the time range or resource scope."
        />
      ) : (
        <>
          <DataTable
            columns={columns}
            data={events}
            rowKey={(item) => item.id}
            onRowClick={(item) => setExpandedId(expandedId === item.id ? null : item.id)}
            emptyState={null}
          />
          {expandedEvent?.metadata && Object.keys(expandedEvent.metadata).length > 0 ? (
            <Panel className="mt-4 p-4">
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <p className="mb-2 text-xs font-semibold text-text-soft">Metadata</p>
                  <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg bg-[color:var(--dusk-surface-inverse)] p-3 text-xs font-mono text-[color:var(--dusk-text-inverse)]">
                    {JSON.stringify(expandedEvent.metadata, null, 2)}
                  </pre>
                </div>
                {expandedEvent.ipAddress ? (
                  <div>
                    <p className="mb-1 text-xs font-semibold text-text-soft">IP Address</p>
                    <code className="text-xs font-mono text-text-muted">{expandedEvent.ipAddress}</code>
                  </div>
                ) : null}
              </div>
            </Panel>
          ) : null}
        </>
      )}

      {totalPages > 1 ? (
        <div className="mt-4 flex justify-center gap-2">
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
      ) : null}
    </div>
  );
}
