import React from 'react';
import { useOutletContext } from 'react-router-dom';
import { type ThemeMode } from '../shared/theme';
import {
  Button,
  CenteredSpinner,
  FilterBar,
  MetricCard,
  PageHeader,
  Panel,
  TrendChart,
} from '../system';
import {
  MetricIcon,
  OverviewSidebar,
  WorkQueueTable,
} from './overview.components';
import {
  useAttentionItems,
  useOverviewDashboardModel,
  useOverviewData,
  useOverviewFilters,
} from './hooks';
import { fmtCurrency, fmtNum, fmtPctCompact, toNumber } from './overview.utils';

export default function AdOpsOverview() {
  useOutletContext<{ theme: ThemeMode; toggleTheme: () => void }>();

  const filters = useOverviewFilters();
  const {
    campaigns,
    tags,
    creatives,
    workspaces,
    activeWorkspaceId,
    loading,
    error,
    currentStats,
    previousStats,
    timeline,
    campaignBreakdown,
    tagBreakdown,
    creativeBreakdown,
    identitySegments,
  } = useOverviewData({
    dateRange: filters.dateRange,
    campaignId: filters.campaignId,
  });

  const attentionItems = useAttentionItems({
    campaignBreakdown,
    creatives,
    creativeBreakdown,
    previousCtr: toNumber(previousStats.avg_ctr),
    tagBreakdown,
    tags,
  });

  const selectedWorkspaceName =
    workspaces.find((workspace) => workspace.id === activeWorkspaceId)?.name ?? 'Workspace';

  const {
    metricCards,
    workspacePerformanceData,
    workQueueRows,
    liveCampaignCount,
    readyCreativeCount,
    draftSetupCount,
    issueCount,
  } = useOverviewDashboardModel({
    attentionItems,
    campaignBreakdown,
    campaigns,
    creatives,
    creativeBreakdown,
    currentStats,
    previousStats,
    tags,
    timeline,
    identitySegments,
    overviewSearch: filters.overviewSearch,
    selectedWorkspaceName,
  });

  const campaignOptions = [
    { value: '', label: 'All campaigns' },
    ...campaigns.map((campaign) => ({
      value: campaign.id,
      label: campaign.name,
    })),
  ];

  const activeFilterCount = [
    filters.campaignId !== '',
    filters.dateRange !== 7,
    filters.overviewSearch.trim() !== '',
  ].filter(Boolean).length;

  if (loading) {
    return <CenteredSpinner label="Loading overview…" />;
  }

  if (error) {
    return (
      <Panel
        className="mt-6 border-[color:var(--dusk-status-critical-border)] bg-[color:var(--dusk-status-critical-bg)] px-5 py-4 text-sm text-[color:var(--dusk-status-critical-fg)]"
        role="alert"
      >
        <p className="font-medium">We could not load the overview workspace.</p>
        <p className="mt-1 text-sm">
          Check workspace access or refresh the page, then retry. Details: {error}
        </p>
      </Panel>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-6 py-6">
      <PageHeader
        kicker={`Overview · ${selectedWorkspaceName}`}
        title="Overview"
        meta={`${liveCampaignCount} live · ${readyCreativeCount} creatives ready · ${draftSetupCount} drafts · ${issueCount} need review`}
        alert={
          issueCount > 0 ? (
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <p className="text-sm font-medium">
                {issueCount} item{issueCount === 1 ? '' : 's'} need attention before scaling delivery.
              </p>
            </div>
          ) : null
        }
      />

      <FilterBar
        pills={[
          {
            id: 'date-range',
            label: 'Date range',
            value: String(filters.dateRange),
            options: [
              { value: '7', label: 'Last 7 days' },
              { value: '30', label: 'Last 30 days' },
              { value: '90', label: 'Last 90 days' },
            ],
            onChange: (value) => filters.setDateRange(Number(value) as 7 | 30 | 90),
          },
          {
            id: 'campaign',
            label: 'Campaign',
            value: filters.campaignId,
            options: campaignOptions,
            onChange: filters.setCampaignId,
          },
        ]}
        search={{
          value: filters.overviewSearch,
          onChange: filters.setOverviewSearch,
          placeholder: 'Search campaign, advertiser, owner',
        }}
        activeFilterCount={activeFilterCount}
        onResetAll={() => {
          filters.setDateRange(7);
          filters.setCampaignId('');
          filters.setOverviewSearch('');
        }}
      />

      <div className="grid gap-5 xl:grid-cols-4">
        {metricCards.map((metric) => (
          <MetricCard
            key={metric.id}
            label={metric.label}
            value={metric.value}
            delta={metric.delta}
            trend={metric.direction}
            context={metric.context}
            series={metric.series}
            tone={
              metric.icon === 'spend'
                ? 'info'
                : metric.icon === 'impressions'
                  ? 'brand'
                  : metric.icon === 'ctr'
                    ? 'success'
                    : metric.icon === 'engagements'
                      ? 'critical'
                      : 'neutral'
            }
            icon={<MetricIcon icon={metric.icon} />}
          />
        ))}
      </div>

      <Panel className="p-6">
        <div className="mb-4">
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Workspace performance</p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-text-primary">
            Workspace performance (30d)
          </h2>
          <p className="mt-2 text-sm text-text-muted">
            Real delivery, spend, CTR and engagement signals for the selected workspace and campaign scope.
          </p>
        </div>
        <TrendChart
          data={workspacePerformanceData}
          xKey="date"
          kind="line"
          title="Workspace performance for the last 30 days"
          description="Line chart showing impressions, spend, click-through rate, and engagements over time."
          series={[
            { key: 'impressions', label: 'Impressions', tone: 'brand', format: (value) => fmtNum(value) },
            { key: 'spend', label: 'Spend', tone: 'info', format: (value) => fmtCurrency(value) },
            { key: 'ctr', label: 'CTR', tone: 'success', format: (value) => fmtPctCompact(value) },
            { key: 'engagements', label: 'Engagements', tone: 'critical', format: (value) => fmtNum(value) },
          ]}
        />
      </Panel>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.8fr)]">
        <WorkQueueTable rows={workQueueRows} />
        <OverviewSidebar
          attentionItems={attentionItems}
          liveCampaignCount={liveCampaignCount}
          readyCreativeCount={readyCreativeCount}
          draftSetupCount={draftSetupCount}
        />
      </div>
    </div>
  );
}
