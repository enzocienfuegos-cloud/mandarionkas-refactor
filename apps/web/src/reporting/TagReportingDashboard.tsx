import React, { useCallback, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Panel,
  Kicker,
  EmptyState,
  CenteredSpinner,
} from '../system';
import type { ReportingTab } from './tag-reporting/types';
import {
  DATE_RANGE_OPTIONS,
  REPORTING_TAB_OPTIONS,
  exportTagReportingWorkbook,
} from './tag-reporting/utils';
import {
  DisplayReportingView,
  IdentityReportingView,
  VideoReportingView,
} from './tag-reporting/views';
import { ReportingWorkspaceControls, TagSelectorPanel } from './tag-reporting/components';
import { useTagReportingData } from './tag-reporting/hooks';

export default function TagReportingDashboard() {
  const { id: routeTagId = '' } = useParams();
  const [exporting, setExporting] = useState(false);
  const [activeTab, setActiveTab] = useState<ReportingTab>('display');
  const {
    selectedTag,
    setSelectedTag,
    summary,
    stats,
    bindings,
    loadingTags,
    loadingBindings,
    loadingStats,
    error,
    statsError,
    setStatsError,
    dateRange,
    setDateRange,
    tagSearch,
    setTagSearch,
    selectedCreativeId,
    setSelectedCreativeId,
    selectedVariantId,
    setSelectedVariantId,
    creativeOptions,
    variantOptions,
    filteredTags,
    loadTagData,
  } = useTagReportingData(routeTagId);

  const handleExport = useCallback(async () => {
    if (!selectedTag || !summary) return;
    setExporting(true);
    try {
      await exportTagReportingWorkbook({
        tagName: selectedTag.name,
        dateRange,
        selectedCreativeName: creativeOptions.find(option => option.id === selectedCreativeId)?.name ?? 'All',
        selectedVariantName: variantOptions.find(option => option.id === selectedVariantId)?.name ?? 'All',
        summary,
        stats,
      });
    } catch (exportError) {
      setStatsError(exportError instanceof Error ? exportError.message : 'Failed to export Excel file.');
    } finally {
      setExporting(false);
    }
  }, [creativeOptions, dateRange, selectedCreativeId, selectedTag, selectedVariantId, stats, summary, variantOptions]);

  if (loadingTags) {
    return <CenteredSpinner label="Loading tag reporting…" />;
  }

  if (error) {
    return (
      <Panel className="border-[color:var(--dusk-status-critical-border)] bg-[color:var(--dusk-status-critical-bg)] p-4 text-[color:var(--dusk-status-critical-fg)]">
        <p className="font-medium">Error loading tags</p>
        <p className="text-sm mt-1">{error}</p>
      </Panel>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-6 py-6">
      <div className="flex flex-col gap-3">
        <div>
          <Kicker>Reporting</Kicker>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[color:var(--dusk-text-primary)]">Tag Reporting</h1>
          <p className="mt-2 text-sm leading-6 text-[color:var(--dusk-text-secondary)]">Tag-level impression, click, identity, and video analytics in one operational view.</p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[18rem_minmax(0,1fr)]">
        <div className="basis-[18rem] flex-shrink-0">
          <TagSelectorPanel
            filteredTags={filteredTags}
            selectedTagId={selectedTag?.id ?? null}
            tagSearch={tagSearch}
            onSearchChange={setTagSearch}
            onSelectTag={setSelectedTag}
          />
        </div>

        <div className="flex-1 min-w-0">
          {!selectedTag ? (
            <EmptyState
              kicker="Awaiting selection"
              title="Select a tag to view statistics"
              description="Choose a tag from the list to load delivery, identity, and video reporting."
            />
          ) : (
            <>
              <ReportingWorkspaceControls
                selectedTagName={selectedTag.name}
                selectedTagFormat={selectedTag.format}
                dateRange={dateRange}
                onDateRangeChange={setDateRange}
                exporting={exporting}
                loadingStats={loadingStats}
                canExport={Boolean(summary)}
                onExport={() => void handleExport()}
                selectedCreativeId={selectedCreativeId}
                onSelectedCreativeIdChange={setSelectedCreativeId}
                selectedVariantId={selectedVariantId}
                onSelectedVariantIdChange={setSelectedVariantId}
                creativeOptions={creativeOptions.map((option) => ({ value: option.id, label: option.name }))}
                variantOptions={variantOptions.map((option) => ({ value: option.id, label: option.name }))}
                selectedCreativeName={creativeOptions.find((option) => option.id === selectedCreativeId)?.name ?? 'All creatives'}
                selectedVariantName={variantOptions.find((option) => option.id === selectedVariantId)?.name ?? 'All sizes'}
                loadingBindings={loadingBindings}
                bindingCount={bindings.length}
                statsError={statsError}
                onRetry={() => {
                  if (!selectedTag) return;
                  loadTagData(selectedTag, dateRange, {
                    creativeId: selectedCreativeId,
                    creativeSizeVariantId: selectedVariantId,
                  });
                }}
                activeTab={activeTab}
                onActiveTabChange={setActiveTab}
                dateRangeOptions={DATE_RANGE_OPTIONS}
                reportingTabOptions={REPORTING_TAB_OPTIONS}
              />

              {loadingStats ? (
                <CenteredSpinner label="Loading tag statistics…" />
              ) : (
                <>
                  {activeTab === 'display' ? <DisplayReportingView dateRange={dateRange} stats={stats} summary={summary} /> : null}
                  {activeTab === 'video' ? <VideoReportingView stats={stats} summary={summary} /> : null}
                  {activeTab === 'identity' ? <IdentityReportingView summary={summary} /> : null}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
