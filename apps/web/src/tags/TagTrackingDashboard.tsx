import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

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
}

interface DailyStat {
  date: string;
  impressions: number | string;
  clicks: number | string;
  viewable_imps: number | string;
  measured_imps: number | string;
  undetermined_imps: number | string;
  spend: number | string;
}

interface EventStat {
  date: string;
  event_type: string;
  event_count: number | string;
  total_duration_ms: number | string | null;
}

const DAY_OPTIONS = [7, 14, 30, 60, 90];

function formatNumber(value: number | string | null | undefined) {
  return new Intl.NumberFormat().format(Number(value || 0));
}

function formatCurrency(value: number | string | null | undefined) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(Number(value || 0));
}

export default function TagTrackingDashboard() {
  const { id } = useParams<{ id: string }>();
  const [days, setDays] = useState(30);
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
        if (!response.ok) throw new Error('Failed to load tag.');
        return response.json();
      }),
      fetch(`/v1/tracking/tags/${id}/summary?days=${days}`, { credentials: 'include' }).then(async (response) => {
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload?.message ?? 'Failed to load tracking summary.');
        }
        return response.json();
      }),
      fetch(`/v1/tracking/tags/${id}/daily?days=${days}`, { credentials: 'include' }).then(async (response) => {
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload?.message ?? 'Failed to load tracking history.');
        }
        return response.json();
      }),
      fetch(`/v1/tracking/tags/${id}/events?days=${days}`, { credentials: 'include' }).then(async (response) => {
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload?.message ?? 'Failed to load tracking events.');
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
      .catch((caught: any) => setError(caught?.message ?? 'Failed to load tracking.'))
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

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-t-2 border-fuchsia-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Tag Tracking</p>
          <h1 className="mt-2 text-2xl font-bold text-slate-800">{tag?.name ?? 'Tracking insights'}</h1>
          <p className="mt-1 text-sm text-slate-500">
            Delivery, click-through, and engagement telemetry for this tag.
            {tag?.campaign?.name ? ` Campaign: ${tag.campaign.name}.` : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={days} onChange={(event) => setDays(Number(event.target.value) || 30)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            {DAY_OPTIONS.map((option) => (
              <option key={option} value={option}>Last {option} days</option>
            ))}
          </select>
          <Link to={`/tags/${id}`} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Back to tag
          </Link>
          <Link to={`/tags/${id}/pixels`} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Pixels
          </Link>
          <Link to={`/tags/${id}/reporting`} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Reporting
          </Link>
        </div>
      </div>

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Impressions</p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{formatNumber(summary?.impressions)}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">CTR</p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{rates.ctr.toFixed(2)}%</p>
          <p className="mt-1 text-sm text-slate-500">{formatNumber(summary?.clicks)} clicks</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Viewability</p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{rates.viewability.toFixed(2)}%</p>
          <p className="mt-1 text-sm text-slate-500">{formatNumber(summary?.viewable_impressions)} of {formatNumber(summary?.measured_impressions)} measured</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Spend</p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{formatCurrency(summary?.spend)}</p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(340px,0.8fr)]">
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
          <div className="border-b border-slate-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-slate-900">Daily delivery trend</h2>
            <p className="mt-1 text-sm text-slate-500">Use this to inspect whether performance changed after tag edits, pixel changes, or trafficking updates.</p>
          </div>
          {dailyStats.length === 0 ? (
            <div className="px-6 py-10 text-sm text-slate-500">No delivery stats are available for the selected window.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    {['Date', 'Impressions', 'Clicks', 'CTR', 'Viewable', 'Measured', 'Spend'].map((heading) => (
                      <th key={heading} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {dailyStats.map((row) => {
                    const impressions = Number(row.impressions || 0);
                    const clicks = Number(row.clicks || 0);
                    const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
                    return (
                      <tr key={row.date}>
                        <td className="px-4 py-3 text-sm text-slate-700">{new Date(row.date).toLocaleDateString()}</td>
                        <td className="px-4 py-3 text-sm text-slate-700">{formatNumber(row.impressions)}</td>
                        <td className="px-4 py-3 text-sm text-slate-700">{formatNumber(row.clicks)}</td>
                        <td className="px-4 py-3 text-sm text-slate-700">{ctr.toFixed(2)}%</td>
                        <td className="px-4 py-3 text-sm text-slate-700">{formatNumber(row.viewable_imps)}</td>
                        <td className="px-4 py-3 text-sm text-slate-700">{formatNumber(row.measured_imps)}</td>
                        <td className="px-4 py-3 text-sm text-slate-700">{formatCurrency(row.spend)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-slate-900">Event mix</h2>
            <p className="mt-1 text-sm text-slate-500">Aggregated engagement events captured for this tag.</p>
            <div className="mt-4 space-y-3">
              {Object.keys(groupedEvents).length === 0 ? (
                <p className="text-sm text-slate-500">No event telemetry yet.</p>
              ) : (
                Object.entries(groupedEvents).map(([eventType, bucket]) => (
                  <div key={eventType} className="rounded-xl bg-slate-50 px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-medium capitalize text-slate-700">{eventType.replace(/_/g, ' ')}</span>
                      <span className="text-sm font-semibold text-slate-900">{formatNumber(bucket.count)}</span>
                    </div>
                    {bucket.durationMs > 0 ? (
                      <p className="mt-1 text-xs text-slate-500">Total duration: {(bucket.durationMs / 1000).toFixed(1)}s</p>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
            <div className="border-b border-slate-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-slate-900">Recent event rows</h2>
            </div>
            {events.length === 0 ? (
              <div className="px-6 py-8 text-sm text-slate-500">No event rows in the selected window.</div>
            ) : (
              <div className="max-h-[380px] overflow-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      {['Date', 'Event', 'Count', 'Duration'].map((heading) => (
                        <th key={heading} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">{heading}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {events.map((event, index) => (
                      <tr key={`${event.date}-${event.event_type}-${index}`}>
                        <td className="px-4 py-3 text-sm text-slate-700">{new Date(event.date).toLocaleDateString()}</td>
                        <td className="px-4 py-3 text-sm capitalize text-slate-700">{event.event_type.replace(/_/g, ' ')}</td>
                        <td className="px-4 py-3 text-sm text-slate-700">{formatNumber(event.event_count)}</td>
                        <td className="px-4 py-3 text-sm text-slate-700">
                          {Number(event.total_duration_ms || 0) > 0 ? `${(Number(event.total_duration_ms || 0) / 1000).toFixed(1)}s` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
