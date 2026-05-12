import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Button,
  CenteredSpinner,
  DataTable,
  EmptyState,
  Kicker,
  MetricCard,
  Panel,
  Select,
  type ColumnDef,
} from '../system';

interface TagRecord {
  id: string;
  name: string;
  workspaceName?: string | null;
  campaign?: { id: string; name: string } | null;
}

interface TrackingSummary {
  impressions: number | string;
  clicks: number | string;
  viewable_impressions: number | string;
  measured_impressions: number | string;
  undetermined_impressions: number | string;
  spend: number | string;
  spend_without_margin?: number | string;
  spend_with_margin?: number | string;
}

interface DailyStat {
  date: string;
  impressions: number | string;
  clicks: number | string;
  viewable_imps: number | string;
  measured_imps: number | string;
  undetermined_imps: number | string;
  spend: number | string;
  spend_without_margin?: number | string;
  spend_with_margin?: number | string;
}

interface EventStat {
  date: string;
  event_type: string;
  event_count: number | string;
  total_duration_ms: number | string | null;
}

const DAY_OPTIONS = [7, 14, 30, 60, 90];
const SPEND_VIEW_OPTIONS = [
  { value: 'without_margin', label: 'Without margin' },
  { value: 'with_margin', label: 'With margin' },
] as const;

function formatNumber(value: number | string | null | undefined) {
  return new Intl.NumberFormat().format(Number(value || 0));
}

function formatCurrency(value: number | string | null | undefined) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(Number(value || 0));
}

function resolveSpendValue(
  source: { spend?: number | string; spend_without_margin?: number | string; spend_with_margin?: number | string } | null | undefined,
  spendView: 'without_margin' | 'with_margin',
) {
  const withoutMargin = Number(source?.spend_without_margin ?? source?.spend ?? 0);
  const withMargin = Number(source?.spend_with_margin ?? withoutMargin);
  return spendView === 'with_margin' ? withMargin : withoutMargin;
}

export default function TagTrackingDashboard() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [days, setDays] = useState(30);
  const [spendView, setSpendView] = useState<'without_margin' | 'with_margin'>('without_margin');
  const [tag, setTag] = useState<TagRecord | null>(null);
  const [summary, setSummary] = useState<TrackingSummary | null>(null);
  const [dailyStats, setDailyStats] = useState<DailyStat[]>([]);
  const [events, setEvents] = useState<EventStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError('');
    Promise.all([
      fetch(`/v1/tags/${id}`, { credentials: 'include' }).then(async (response) => {
        if (!response.ok) throw new Error('Couldn’t load this tag. It may have been removed or you may not have access to its workspace.');
        return response.json();
      }),
      fetch(`/v1/tracking/tags/${id}/summary?days=${days}`, { credentials: 'include' }).then(async (response) => {
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload?.message ?? 'Couldn’t load delivery totals for this tag.');
        }
        return response.json();
      }),
      fetch(`/v1/tracking/tags/${id}/daily?days=${days}`, { credentials: 'include' }).then(async (response) => {
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload?.message ?? 'Couldn’t load daily tracking history for this tag.');
        }
        return response.json();
      }),
      fetch(`/v1/tracking/tags/${id}/events?days=${days}`, { credentials: 'include' }).then(async (response) => {
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload?.message ?? 'Couldn’t load event telemetry for this tag.');
        }
        return response.json();
      }),
    ])
      .then(([tagPayload, summaryPayload, dailyPayload, eventPayload]) => {
        setTag(tagPayload.tag ?? null);
        setSummary(summaryPayload.summary ?? null);
        setDailyStats(dailyPayload.stats ?? []);
        setEvents(eventPayload.events ?? []);
      })
      .catch((caught: any) => setError(caught?.message ?? 'Couldn’t load tag tracking right now. Refresh the page or shorten the reporting window.'))
      .finally(() => setLoading(false));
  }, [days, id]);

  const rates = useMemo(() => {
    const impressions = Number(summary?.impressions || 0);
    const clicks = Number(summary?.clicks || 0);
    const measured = Number(summary?.measured_impressions || 0);
    const viewable = Number(summary?.viewable_impressions || 0);
    return {
      ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
      viewability: measured > 0 ? (viewable / measured) * 100 : 0,
    };
  }, [summary]);

  const groupedEvents = useMemo(() => {
    return events.reduce<Record<string, { count: number; durationMs: number }>>((accumulator, event) => {
      const bucket = accumulator[event.event_type] ?? { count: 0, durationMs: 0 };
      bucket.count += Number(event.event_count || 0);
      bucket.durationMs += Number(event.total_duration_ms || 0);
      accumulator[event.event_type] = bucket;
      return accumulator;
    }, {});
  }, [events]);

  const dailyRows = useMemo(() => {
    return dailyStats.map((row) => {
      const impressions = Number(row.impressions || 0);
      const clicks = Number(row.clicks || 0);
      const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
      return {
        ...row,
        ctr,
      };
    });
  }, [dailyStats]);

  const dailyColumns = useMemo<ColumnDef<(typeof dailyRows)[number]>[]>(() => [
    {
      id: 'date',
      header: 'Date',
      sortAccessor: (row) => row.date,
      cell: (row) => new Date(row.date).toLocaleDateString(),
    },
    {
      id: 'impressions',
      header: 'Impressions',
      align: 'right',
      numeric: true,
      sortAccessor: (row) => Number(row.impressions || 0),
      cell: (row) => formatNumber(row.impressions),
    },
    {
      id: 'clicks',
      header: 'Clicks',
      align: 'right',
      numeric: true,
      sortAccessor: (row) => Number(row.clicks || 0),
      cell: (row) => formatNumber(row.clicks),
    },
    {
      id: 'ctr',
      header: 'CTR',
      align: 'right',
      numeric: true,
      sortAccessor: (row) => row.ctr,
      cell: (row) => `${row.ctr.toFixed(2)}%`,
    },
    {
      id: 'viewable',
      header: 'Viewable',
      align: 'right',
      numeric: true,
      sortAccessor: (row) => Number(row.viewable_imps || 0),
      cell: (row) => formatNumber(row.viewable_imps),
    },
    {
      id: 'measured',
      header: 'Measured',
      align: 'right',
      numeric: true,
      sortAccessor: (row) => Number(row.measured_imps || 0),
      cell: (row) => formatNumber(row.measured_imps),
    },
    {
      id: 'spend',
      header: 'Spend',
      align: 'right',
      numeric: true,
      sortAccessor: (row) => resolveSpendValue(row, spendView),
      cell: (row) => formatCurrency(resolveSpendValue(row, spendView)),
    },
  ], [dailyRows, spendView]);

  const eventRows = useMemo(() => {
    return events.map((event, index) => ({
      ...event,
      id: `${event.date}-${event.event_type}-${index}`,
    }));
  }, [events]);

  const eventColumns = useMemo<ColumnDef<(typeof eventRows)[number]>[]>(() => [
    {
      id: 'date',
      header: 'Date',
      sortAccessor: (row) => row.date,
      cell: (row) => new Date(row.date).toLocaleDateString(),
    },
    {
      id: 'event',
      header: 'Event',
      sortAccessor: (row) => row.event_type,
      cell: (row) => row.event_type.replace(/_/g, ' '),
    },
    {
      id: 'count',
      header: 'Count',
      align: 'right',
      numeric: true,
      sortAccessor: (row) => Number(row.event_count || 0),
      cell: (row) => formatNumber(row.event_count),
    },
    {
      id: 'duration',
      header: 'Duration',
      align: 'right',
      numeric: true,
      sortAccessor: (row) => Number(row.total_duration_ms || 0),
      cell: (row) => Number(row.total_duration_ms || 0) > 0 ? `${(Number(row.total_duration_ms || 0) / 1000).toFixed(1)}s` : '—',
    },
  ], [eventRows]);

  if (loading) {
    return <CenteredSpinner label="Loading tracking dashboard…" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Kicker>Tag Tracking</Kicker>
          <h1 className="mt-2 text-2xl font-bold text-[color:var(--dusk-text-primary)]">{tag?.name ?? 'Tracking insights'}</h1>
          <p className="mt-1 text-sm text-[color:var(--dusk-text-muted)]">
            Delivery, click-through, and engagement telemetry for this tag.
            {tag?.campaign?.name ? ` Campaign: ${tag.campaign.name}.` : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={String(days)}
            onChange={(event) => setDays(Number(event.target.value) || 30)}
            options={DAY_OPTIONS.map((option) => ({ value: String(option), label: `Last ${option} days` }))}
          />
          <Select
            value={spendView}
            onChange={(event) => setSpendView(event.target.value as 'without_margin' | 'with_margin')}
            options={SPEND_VIEW_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
          />
          <Button variant="secondary" onClick={() => navigate(`/tags/${id}`)}>Back to tag</Button>
          <Button variant="secondary" onClick={() => navigate(`/tags/${id}/pixels`)}>Pixels</Button>
          <Button variant="secondary" onClick={() => navigate(`/tags/${id}/reporting`)}>Reporting</Button>
        </div>
      </div>

      {error ? (
        <Panel className="border-[color:var(--dusk-status-critical-border)] bg-[color:var(--dusk-status-critical-bg)] p-4 text-[color:var(--dusk-status-critical-fg)]">
          <p className="font-medium">Tracking load failed</p>
          <p className="mt-1 text-sm">{error}</p>
        </Panel>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Impressions" value={formatNumber(summary?.impressions)} tone="brand" />
        <MetricCard label="CTR" value={`${rates.ctr.toFixed(2)}%`} context={`${formatNumber(summary?.clicks)} clicks`} tone="info" />
        <MetricCard label="Viewability" value={`${rates.viewability.toFixed(2)}%`} context={`${formatNumber(summary?.viewable_impressions)} of ${formatNumber(summary?.measured_impressions)} measured`} tone="success" />
        <MetricCard
          label={spendView === 'with_margin' ? 'Spend with margin' : 'Spend without margin'}
          value={formatCurrency(resolveSpendValue(summary, spendView))}
          tone="warning"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(340px,0.8fr)]">
        <Panel className="overflow-hidden">
          <div className="border-b border-[color:var(--dusk-border-default)] px-6 py-4">
            <h2 className="text-lg font-semibold text-[color:var(--dusk-text-primary)]">Daily delivery trend</h2>
            <p className="mt-1 text-sm text-[color:var(--dusk-text-muted)]">Use this to inspect whether performance changed after tag edits, pixel changes, or trafficking updates.</p>
          </div>
          <DataTable
            columns={dailyColumns}
            data={dailyRows}
            rowKey={(row) => row.date}
            bordered={false}
            emptyState={
              <EmptyState
                title="No delivery stats yet"
                description="No delivery stats are available for the selected window."
              />
            }
          />
        </Panel>

        <div className="space-y-6">
          <Panel>
            <h2 className="text-lg font-semibold text-[color:var(--dusk-text-primary)]">Event mix</h2>
            <p className="mt-1 text-sm text-[color:var(--dusk-text-muted)]">Aggregated engagement events captured for this tag.</p>
            <div className="mt-4 space-y-3">
              {Object.keys(groupedEvents).length === 0 ? (
                <p className="text-sm text-[color:var(--dusk-text-muted)]">No event telemetry yet.</p>
              ) : (
                Object.entries(groupedEvents).map(([eventType, bucket]) => (
                  <div key={eventType} className="rounded-xl bg-surface-muted px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-medium capitalize text-[color:var(--dusk-text-secondary)]">{eventType.replace(/_/g, ' ')}</span>
                      <span className="text-sm font-semibold text-[color:var(--dusk-text-primary)]">{formatNumber(bucket.count)}</span>
                    </div>
                    {bucket.durationMs > 0 ? (
                      <p className="mt-1 text-xs text-[color:var(--dusk-text-muted)]">Total duration: {(bucket.durationMs / 1000).toFixed(1)}s</p>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </Panel>

          <Panel className="overflow-hidden">
            <div className="border-b border-[color:var(--dusk-border-default)] px-6 py-4">
              <h2 className="text-lg font-semibold text-[color:var(--dusk-text-primary)]">Recent event rows</h2>
            </div>
            <DataTable
              columns={eventColumns}
              data={eventRows}
              rowKey={(row) => row.id}
              bordered={false}
              emptyState={
                <EmptyState
                  title="No event rows yet"
                  description="No event rows were captured in the selected window."
                />
              }
            />
          </Panel>
        </div>
      </div>
    </div>
  );
}
