import React from 'react';
import { EmptyState, Panel } from '../../system';
import { BarChart, DetailRow, KpiCard, ReportingBreakdownTable } from './components';
import type { DailyStat, TagSummary } from './types';
import {
  deriveIdentitySource,
  deriveInventoryEnvironment,
  fmtDurationFromMs,
  fmtNum,
  titleCase,
} from './utils';

export function DisplayReportingView({
  dateRange,
  stats,
  summary,
}: {
  dateRange: number;
  stats: DailyStat[];
  summary: TagSummary | null;
}) {
  return (
    <>
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-8">
        <KpiCard label="Total Impressions" value={summary ? fmtNum(summary.totalImpressions) : '—'} />
        <KpiCard label="Total Clicks" value={summary ? fmtNum(summary.totalClicks) : '—'} />
        <KpiCard label="CTR" value={summary ? `${summary.ctr.toFixed(2)}%` : '—'} />
        <KpiCard label="Viewability" value={summary ? `${summary.viewabilityRate.toFixed(2)}%` : '—'} sub="MRC: 50% visible ≥1s" />
        <KpiCard label="Engagement Rate" value={summary ? `${summary.engagementRate.toFixed(2)}%` : '—'} sub="Hover interactions / imps" />
        <KpiCard label="In-View Time" value={summary ? fmtDurationFromMs(summary.totalInViewDurationMs) : '—'} />
        <KpiCard label="Attention Time" value={summary ? fmtDurationFromMs(summary.totalAttentionDurationMs) : '—'} />
        <KpiCard label="Country" value={summary?.latestContext?.country || 'Unknown'} sub={summary?.latestContext?.region || 'Region unknown'} />
      </div>

      <Panel className="p-5">
        <h3 className="mb-4 text-sm font-semibold text-text-secondary">
          Daily Impressions — Last {dateRange} days
        </h3>
        {stats.length === 0 ? (
          <EmptyState
            kicker="Display data pending"
            title="No display activity for this window"
            description="This view fills once the selected tag records impressions or clicks for the active date range."
            className="border-0 bg-transparent py-8 shadow-none"
          />
        ) : (
          <BarChart data={stats} />
        )}
      </Panel>

      <div className="mt-4">
        <ReportingBreakdownTable
          title="Daily Breakdown"
          subtitle="Export uses the same filtered rows"
          emptyTitle="No data for this period"
          emptyDescription="No display delivery rows matched the active filters yet. Try broadening the range or clearing creative/size filters."
          rows={stats}
          columns={[
            { key: 'date', header: 'Date', render: (row) => row.date },
            { key: 'impressions', header: 'Impressions', render: (row) => row.impressions.toLocaleString(), emphasize: true },
            { key: 'clicks', header: 'Clicks', render: (row) => row.clicks.toLocaleString() },
            { key: 'videoStarts', header: 'Play Starts', render: (row) => row.videoStarts.toLocaleString() },
            { key: 'videoCompletions', header: 'Plays Completed', render: (row) => row.videoCompletions.toLocaleString() },
            { key: 'ctr', header: 'CTR', render: (row) => `${(row.impressions > 0 ? (row.clicks / row.impressions) * 100 : 0).toFixed(2)}%` },
            { key: 'startRate', header: 'Start Rate', render: (row) => `${(row.impressions > 0 ? (row.videoStarts / row.impressions) * 100 : 0).toFixed(2)}%` },
            { key: 'completionRate', header: 'Completion Rate', render: (row) => `${(row.videoStarts > 0 ? (row.videoCompletions / row.videoStarts) * 100 : 0).toFixed(2)}%` },
          ]}
        />
      </div>
    </>
  );
}

export function VideoReportingView({
  stats,
  summary,
}: {
  stats: DailyStat[];
  summary: TagSummary | null;
}) {
  return (
    <>
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Last 7d Imps" value={summary ? fmtNum(summary.impressionsLast7d) : '—'} />
        <KpiCard label="Video Starts" value={summary ? fmtNum(summary.videoStarts) : '—'} />
        <KpiCard label="Start Rate" value={summary ? `${summary.videoStartRate.toFixed(2)}%` : '—'} />
        <KpiCard label="Plays Completed" value={summary ? fmtNum(summary.videoCompletions) : '—'} />
        <KpiCard label="Completion Rate" value={summary ? `${summary.videoCompletionRate.toFixed(2)}%` : '—'} />
        <KpiCard label="Country" value={summary?.latestContext?.country || 'Unknown'} sub={summary?.latestContext?.region || 'Region unknown'} />
      </div>

      <ReportingBreakdownTable
        title="Daily Video Breakdown"
        subtitle="Starts and completions for the active filters"
        emptyTitle="No video data for this period"
        emptyDescription="Video metrics appear after the selected tag serves video starts or completions for the current filters."
        rows={stats}
        columns={[
          { key: 'date', header: 'Date', render: (row) => row.date },
          { key: 'impressions', header: 'Impressions', render: (row) => row.impressions.toLocaleString(), emphasize: true },
          { key: 'videoStarts', header: 'Play Starts', render: (row) => row.videoStarts.toLocaleString() },
          { key: 'videoCompletions', header: 'Plays Completed', render: (row) => row.videoCompletions.toLocaleString() },
          { key: 'startRate', header: 'Start Rate', render: (row) => `${(row.impressions > 0 ? (row.videoStarts / row.impressions) * 100 : 0).toFixed(2)}%` },
          { key: 'completionRate', header: 'Completion Rate', render: (row) => `${(row.videoStarts > 0 ? (row.videoCompletions / row.videoStarts) * 100 : 0).toFixed(2)}%` },
        ]}
      />
    </>
  );
}

export function IdentityReportingView({ summary }: { summary: TagSummary | null }) {
  const inventoryEnvironment = deriveInventoryEnvironment(summary?.latestContext ?? null);
  const identitySource = deriveIdentitySource(summary?.latestContext ?? null);
  const siteOrAppType =
    summary?.latestContext?.appId || summary?.latestContext?.appBundle || summary?.latestContext?.appName
      ? 'App'
      : summary?.latestContext?.siteDomain || summary?.latestContext?.pageUrl
        ? 'Web Site'
        : 'Unknown';

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Inventory Environment" value={inventoryEnvironment} sub={identitySource} />
        <KpiCard label="Country" value={summary?.latestContext?.country || 'Unknown'} sub={summary?.latestContext?.region || 'Region unknown'} />
        <KpiCard label="Device Type" value={summary?.latestContext?.deviceType ? titleCase(summary.latestContext.deviceType) : 'Unknown'} sub="Inferred from request" />
        <KpiCard label="Device Model" value={summary?.latestContext?.deviceModel || 'Unknown'} sub="User-agent or DSP reported" />
        <KpiCard label="Unique Devices" value={summary ? fmtNum(summary.uniqueIdentities) : '—'} sub="From tracker identity cookie" />
        <KpiCard label="Avg Frequency" value={summary ? summary.avgFrequency.toFixed(2) : '—'} sub="Impressions per identity" />
        <KpiCard label="Site / App Type" value={siteOrAppType} />
      </div>

      {summary?.latestContext ? (
        <div className="rounded-xl border border-[color:var(--dusk-border-default)] bg-surface-1 p-5">
          <h3 className="mb-4 text-sm font-semibold text-[color:var(--dusk-text-primary)]">Latest Delivery Identity & Context</h3>
          <div className="grid gap-6 lg:grid-cols-3">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-soft">Identity</p>
              <DetailRow label="Inventory Environment" value={inventoryEnvironment} />
              <DetailRow label="Country" value={summary.latestContext.country || 'Unknown'} />
              <DetailRow label="Region" value={summary.latestContext.region || 'Unknown'} />
              <DetailRow label="City" value={summary.latestContext.city || 'Unknown'} />
              <DetailRow label="Device Type" value={titleCase(summary.latestContext.deviceType || 'Unknown')} />
              <DetailRow label="Device Model" value={summary.latestContext.deviceModel || 'Unknown'} />
              <DetailRow label="Browser" value={summary.latestContext.browser || 'Unknown'} />
              <DetailRow label="OS" value={summary.latestContext.os || 'Unknown'} />
              <DetailRow label="Carrier" value={summary.latestContext.carrier || 'n/a'} />
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-soft">Site / App</p>
              <DetailRow label="Site Domain" value={summary.latestContext.siteDomain || 'n/a'} />
              <DetailRow label="Page URL" value={summary.latestContext.pageUrl || 'n/a'} />
              <DetailRow label="App Name" value={summary.latestContext.appName || 'n/a'} />
              <DetailRow label="App ID" value={summary.latestContext.appId || 'n/a'} />
              <DetailRow label="App Bundle" value={summary.latestContext.appBundle || 'n/a'} />
              <DetailRow label="Page Position" value={summary.latestContext.pagePosition || 'n/a'} />
              <DetailRow label="App Store" value={summary.latestContext.appStoreName || 'n/a'} />
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-soft">Supply & Context</p>
              <DetailRow label="Network ID" value={summary.latestContext.networkId || 'n/a'} />
              <DetailRow label="Source Publisher ID" value={summary.latestContext.sourcePublisherId || 'n/a'} />
              <DetailRow label="Exchange ID" value={summary.latestContext.exchangeId || 'n/a'} />
              <DetailRow label="Exchange Publisher ID" value={summary.latestContext.exchangePublisherId || 'n/a'} />
              <DetailRow label="Exchange Site/Domain" value={summary.latestContext.exchangeSiteIdOrDomain || 'n/a'} />
              <DetailRow label="Site ID" value={summary.latestContext.siteId || 'n/a'} />
              <DetailRow label="Contextual IDs" value={summary.latestContext.contextualIds || 'n/a'} />
              <DetailRow label="Content Genre" value={summary.latestContext.contentGenre || 'n/a'} />
              <DetailRow label="Content Title" value={summary.latestContext.contentTitle || 'n/a'} />
              <DetailRow label="Content Series" value={summary.latestContext.contentSeries || 'n/a'} />
              <DetailRow label="Content Language" value={summary.latestContext.contentLanguage || 'n/a'} />
            </div>
          </div>
        </div>
      ) : (
        <EmptyState
          kicker="Identity pending"
          title="No identity context captured yet"
          description="This mode fills from new traffic. Once the selected tag receives requests, we will surface device, site/app and supply context here."
          className="py-10"
        />
      )}
    </div>
  );
}
