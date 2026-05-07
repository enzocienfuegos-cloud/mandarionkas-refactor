import React from 'react';
import { useEffect } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import { type ThemeMode } from '../shared/theme';
import { getSavedView } from '../shared/saved-views';
import {
  Badge,
  Button,
  CenteredSpinner,
  ConfigurableMetricStrip,
  DonutChart,
  FilterBar,
  FunnelChart,
  PageHeader,
  Panel,
  SavedViewsMenu,
  TrendChart,
} from '../system';
import { OverviewSidebar, WorkQueueTable } from './overview.components';
import {
  useAttentionItems,
  useOverviewDashboardModel,
  useOverviewData,
  useOverviewFilters,
} from './hooks';
import { overviewMetricScope } from './overview.metrics';
import { fmtCurrency, fmtNum, fmtPctCompact, toNumber } from './overview.utils';

export default function AdOpsOverview() {
  useOutletContext<{ theme: ThemeMode; toggleTheme: () => void }>();

  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useOverviewFilters();
  const currentViewId = searchParams.get('view');
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

  const impressions = toNumber(currentStats.total_impressions);
  const measurable = currentStats.measurable_rate == null
    ? null
    : impressions * (toNumber(currentStats.measurable_rate) / 100);
  const viewable = currentStats.viewability_rate == null
    ? null
    : impressions * (toNumber(currentStats.viewability_rate) / 100);
  const clicks = toNumber(currentStats.total_clicks);
  const deliveryStages = [
    { id: 'impressions', label: 'Impressions', value: impressions, format: fmtNum },
    ...(measurable != null ? [{ id: 'measurable', label: 'Measurable', value: measurable, format: fmtNum }] : []),
    ...(viewable != null ? [{ id: 'viewable', label: 'Viewable', value: viewable, format: fmtNum }] : []),
    { id: 'clicks', label: 'Clicks', value: clicks, format: fmtNum },
  ].filter((stage, index, all) => stage.value >= 0 && (index === 0 || stage.value <= all[index - 1].value));

  useEffect(() => {
    if (!currentViewId) return;
    let cancelled = false;
    void getSavedView(currentViewId)
      .then((view) => {
        if (cancelled) return;
        if (!view || view.surface !== 'overview') {
          setSearchParams((params) => {
            const next = new URLSearchParams(params);
            next.delete('view');
            return next;
          });
          return;
        }
        const nextFilters = view.filters ?? {};
        filters.setDateRange(([7, 30, 90].includes(Number(nextFilters.dateRange))
          ? Number(nextFilters.dateRange)
          : 7) as 7 | 30 | 90);
        filters.setCampaignId(String(nextFilters.campaignId ?? ''));
        filters.setOverviewSearch(String(nextFilters.overviewSearch ?? ''));
      })
      .catch(() => {
        if (!cancelled) {
          setSearchParams((params) => {
            const next = new URLSearchParams(params);
            next.delete('view');
            return next;
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [
    currentViewId,
    filters.setCampaignId,
    filters.setDateRange,
    filters.setOverviewSearch,
    setSearchParams,
  ]);

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
        meta={(
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="success" size="sm">{liveCampaignCount} live</Badge>
            <Badge tone="info" size="sm">{readyCreativeCount} creatives ready</Badge>
            <Badge tone="neutral" size="sm">{draftSetupCount} drafts</Badge>
            {issueCount > 0 ? <Badge tone="critical" size="sm">{issueCount} need review</Badge> : null}
            <span className="text-xs text-text-soft">· current workspace scope</span>
          </div>
        )}
        alert={
          issueCount > 0 ? (
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <p className="text-sm font-medium">
                {issueCount} item{issueCount === 1 ? '' : 's'} need attention before scaling delivery.
              </p>
            </div>
          ) : null
        }
        secondaryActions={(
          <SavedViewsMenu
            surface="overview"
            currentFilters={{
              dateRange: filters.dateRange,
              campaignId: filters.campaignId,
              overviewSearch: filters.overviewSearch,
            }}
            currentViewId={currentViewId}
            onApplyView={(view) => {
              setSearchParams((params) => {
                const next = new URLSearchParams(params);
                next.set('view', view.id);
                return next;
              });
            }}
            onClearView={() => {
              setSearchParams((params) => {
                const next = new URLSearchParams(params);
                next.delete('view');
                return next;
              });
            }}
          />
        )}
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

      <ConfigurableMetricStrip
        scope={overviewMetricScope}
        data={{
          currentStats,
          previousStats,
          timeline,
          attentionItemsCount: attentionItems.filter((item) => item.severity === 'critical' || item.severity === 'warning').length,
        }}
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.8fr)]">
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

        <div className="grid gap-5">
          <Panel className="p-6">
            <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Status mix</p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-text-primary">Campaign status mix</h2>
            <p className="mt-2 text-sm text-text-muted">How the current workspace breaks down between live, review-needed, and draft work.</p>
            <div className="mt-5">
              <DonutChart
                title="Campaign status mix"
                description="Distribution of live campaigns, issues that need review, and draft setup items."
                segments={[
                  { id: 'live', label: 'Live', value: liveCampaignCount, tone: 'success' },
                  { id: 'review', label: 'Need review', value: issueCount, tone: 'warning' },
                  { id: 'drafts', label: 'Drafts', value: draftSetupCount, tone: 'neutral' },
                ]}
                centerLabel={String(liveCampaignCount + issueCount + draftSetupCount)}
                centerSubLabel="campaigns"
              />
            </div>
          </Panel>

          <Panel className="p-6">
            <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Delivery funnel</p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-text-primary">Impressions to clicks</h2>
            <p className="mt-2 text-sm text-text-muted">How much measured and viewable inventory survives the current scope before it turns into clicks.</p>
            <div className="mt-5">
              <FunnelChart
                title="Delivery funnel"
                description="Delivery funnel from impressions to measurable, viewable, and clicked inventory."
                stages={deliveryStages}
              />
            </div>
          </Panel>
        </div>
      </div>

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
