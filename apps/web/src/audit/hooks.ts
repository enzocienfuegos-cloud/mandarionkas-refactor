import { useCallback, useEffect, useState } from 'react';

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

const LIMIT = 50;

export function useAuditFilters() {
  const [filters, setFilters] = useState({
    action: '',
    actorEmail: '',
    resourceType: 'all',
    dateFrom: '',
    dateTo: '',
  });
  const [pendingFilters, setPendingFilters] = useState({ ...filters });

  const resetFilters = useCallback(() => {
    const empty = { action: '', actorEmail: '', resourceType: 'all', dateFrom: '', dateTo: '' };
    setPendingFilters(empty);
    setFilters(empty);
  }, []);

  return {
    filters,
    setFilters,
    pendingFilters,
    setPendingFilters,
    resetFilters,
  };
}

export function useAuditData({
  canReadAudit,
  filters,
}: {
  canReadAudit: boolean;
  filters: {
    action: string;
    actorEmail: string;
    resourceType: string;
    dateFrom: string;
    dateTo: string;
  };
}) {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback((off = 0) => {
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
      .then((response) => {
        if (!response.ok) throw new Error('We could not load audit events for this filter set.');
        return response.json() as Promise<AuditResponse>;
      })
      .then((payload) => {
        setEvents(payload?.events ?? []);
        setTotal(payload?.total ?? 0);
        setOffset(off);
      })
      .catch((loadError: Error) => setError(loadError.message))
      .finally(() => setLoading(false));
  }, [filters.action, filters.actorEmail, filters.resourceType, filters.dateFrom, filters.dateTo]);

  useEffect(() => {
    if (canReadAudit) load(0);
  }, [canReadAudit, load]);

  return {
    events,
    total,
    offset,
    loading,
    error,
    expandedId,
    setExpandedId,
    load,
  };
}
