import React from 'react';
import { useOutletContext } from 'react-router-dom';
import { type ThemeMode } from '../shared/theme';
import { CenteredSpinner, Kicker, MetricCard, Panel, TrendChart } from '../system';
import {
  MetricIcon,
  OverviewSidebar,
  OverviewToolbar,
  WorkQueueTable,
} from './overview.components';
import { useAttentionItems, useOverviewDashboardModel, useOverviewData, useOverviewFilters } from './hooks';
import { fmtCurrency, fmtNum, fmtPctCompact, toNumber } from './overview.utils';

export default function AdOpsOverview() {
  const { theme, toggleTheme } = useOutletContext<{ theme: ThemeMode; toggleTheme: () => void }>();
  const { dateRange, setDateRange, campaignId, setCampaignId, overviewSearch, setOverviewSearch } = useOverviewFilters();
  const {
    campaigns,
    tags,
    creatives,
    workspaces,
    activeWorkspaceId,
    setCampaignIdOnWorkspaceChange,
    loading,
    error,
    currentStats,
    previousStats,
    timeline,
    campaignBreakdown,
    tagBreakdown,
    creativeBreakdown,
    identitySegments,
  } = useOverviewData({ dateRange, campaignId });
  const attentionItems = useAttentionItems({
    campaignBreakdown,
    creatives,
    creativeBreakdown,
    previousCtr: toNumber(previousStats.avg_ctr),
    tagBreakdown,
    tags,
  });
  const selectedWorkspaceName = workspaces.find((workspace) => workspace.id === activeWorkspaceId)?.name ?? 'Workspace';
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
    overviewSearch,
    selectedWorkspaceName,
  });

  return (
    <div className="min-h-full text-text-primary">
      <div className="dusk-page">
        <OverviewToolbar
          activeWorkspaceId={activeWorkspaceId}
          workspaces={workspaces}
          dateRange={dateRange}
          campaignId={campaignId}
          campaigns={campaigns}
          overviewSearch={overviewSearch}
          onWorkspaceChange={async (value) => {
            const changed = await setCampaignIdOnWorkspaceChange(value);
            if (changed) setCampaignId('');
          }}
          onDateRangeChange={setDateRange}
          onCampaignChange={setCampaignId}
          onSearchChange={setOverviewSearch}
          theme={theme}
          onToggleTheme={toggleTheme}
          issueCount={issueCount}
        />

        {error ? <Panel className="mt-6 border-[color:var(--dusk-status-critical-border)] bg-[color:var(--dusk-status-critical-bg)] px-5 py-4 text-sm text-[color:var(--dusk-status-critical-fg)]">{error}</Panel> : null}

        {loading ? <div className="mt-8"><CenteredSpinner label="Loading overview…" /></div> : null}

        <div className="mt-8 grid gap-5 xl:grid-cols-4">
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
              className="p-1"
            />
          ))}
        </div>

        <Panel className="mt-8 p-6">
          <div className="mb-4">
            <Kicker>Workspace performance</Kicker>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-text-primary">Workspace performance (30d)</h2>
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

        <div className="mt-8 grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.8fr)]">
          <WorkQueueTable rows={workQueueRows} />
          <OverviewSidebar
            attentionItems={attentionItems}
            liveCampaignCount={liveCampaignCount}
            readyCreativeCount={readyCreativeCount}
            draftSetupCount={draftSetupCount}
          />
        </div>
      </div>
    </div>
  );
}
