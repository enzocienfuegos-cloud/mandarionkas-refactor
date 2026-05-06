import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Panel,
  Button,
  Kicker,
  Select,
  EmptyState,
  CenteredSpinner,
} from '../system';
import type { DailyStat, ReportingTab, Tag, TagBindingOption, TagSummary } from './tag-reporting/types';
import {
  DATE_RANGE_OPTIONS,
  REPORTING_TAB_OPTIONS,
  formatVariantName,
  normalizeBindings,
  normalizeDailyStats,
  normalizeTagSummary,
  slugify,
} from './tag-reporting/utils';
import {
  DisplayReportingView,
  IdentityReportingView,
  VideoReportingView,
} from './tag-reporting/views';
import { ReportingWorkspaceControls, TagSelectorPanel } from './tag-reporting/components';

export default function TagReportingDashboard() {
  const { id: routeTagId = '' } = useParams();
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedTag, setSelectedTag] = useState<Tag | null>(null);
  const [summary, setSummary] = useState<TagSummary | null>(null);
  const [stats, setStats] = useState<DailyStat[]>([]);
  const [bindings, setBindings] = useState<TagBindingOption[]>([]);
  const [loadingTags, setLoadingTags] = useState(true);
  const [loadingBindings, setLoadingBindings] = useState(false);
  const [loadingStats, setLoadingStats] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [statsError, setStatsError] = useState('');
  const [dateRange, setDateRange] = useState(7);
  const [tagSearch, setTagSearch] = useState('');
  const [selectedCreativeId, setSelectedCreativeId] = useState('');
  const [selectedVariantId, setSelectedVariantId] = useState('');
  const [activeTab, setActiveTab] = useState<ReportingTab>('display');

  useEffect(() => {
    fetch('/v1/tags?scope=all&limit=500', { credentials: 'include' })
      .then(r => {
        if (!r.ok) throw new Error('Failed to load tags');
        return r.json();
      })
      .then(d => {
        const list: Tag[] = d?.tags ?? d ?? [];
        setTags(list);
        if (!list.length) return;
        const initial = routeTagId
          ? list.find(tag => tag.id === routeTagId) ?? list[0]
          : list[0];
        setSelectedTag(initial);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoadingTags(false));
  }, [routeTagId]);

  useEffect(() => {
    if (!routeTagId) return;
    fetch(`/v1/tags/${routeTagId}`, { credentials: 'include' })
      .then(r => {
        if (!r.ok) throw new Error('Failed to load selected tag');
        return r.json();
      })
      .then(data => {
        const rawTag = data?.tag ?? data;
        if (!rawTag?.id) return;
        const normalizedTag: Tag = {
          id: String(rawTag.id),
          name: String(rawTag.name ?? ''),
          format: String(rawTag.format ?? ''),
        };
        setTags(prev => prev.some(tag => tag.id === normalizedTag.id) ? prev : [normalizedTag, ...prev]);
        setSelectedTag(normalizedTag);
      })
      .catch(() => {
        // Leave the list-selected fallback in place if the direct fetch fails.
      });
  }, [routeTagId]);

  useEffect(() => {
    if (!selectedTag) {
      setBindings([]);
      return;
    }

    setLoadingBindings(true);
    fetch(`/v1/tags/${selectedTag.id}/bindings`, { credentials: 'include' })
      .then(r => {
        if (!r.ok) throw new Error('Failed to load tag bindings');
        return r.json();
      })
      .then(data => {
        setBindings(normalizeBindings(data?.bindings ?? data ?? []));
      })
      .catch(() => setBindings([]))
      .finally(() => setLoadingBindings(false));
  }, [selectedTag]);

  useEffect(() => {
    setSelectedCreativeId('');
    setSelectedVariantId('');
  }, [selectedTag?.id]);

  const creativeOptions = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    bindings.forEach(binding => {
      if (!binding.creativeId || map.has(binding.creativeId)) return;
      map.set(binding.creativeId, { id: binding.creativeId, name: binding.creativeName || binding.creativeId });
    });
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [bindings]);

  const variantOptions = useMemo(() => {
    const base = selectedCreativeId
      ? bindings.filter(binding => binding.creativeId === selectedCreativeId)
      : bindings;
    const map = new Map<string, { id: string; name: string }>();
    base.forEach(binding => {
      if (!binding.creativeSizeVariantId || map.has(binding.creativeSizeVariantId)) return;
      map.set(binding.creativeSizeVariantId, {
        id: binding.creativeSizeVariantId,
        name: formatVariantName(binding),
      });
    });
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [bindings, selectedCreativeId]);

  useEffect(() => {
    if (selectedVariantId && !variantOptions.some(option => option.id === selectedVariantId)) {
      setSelectedVariantId('');
    }
  }, [selectedVariantId, variantOptions]);

  const filteredTags = useMemo(() => {
    const needle = tagSearch.trim().toLowerCase();
    if (!needle) return tags;
    return tags.filter(tag => tag.name.toLowerCase().includes(needle));
  }, [tags, tagSearch]);

  const loadTagData = useCallback((tag: Tag, days: number, filters: { creativeId: string; creativeSizeVariantId: string }) => {
    setLoadingStats(true);
    setStatsError('');

    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - days);
    const from = dateFrom.toISOString().slice(0, 10);
    const params = new URLSearchParams({ dateFrom: from });
    if (filters.creativeId) params.set('creativeId', filters.creativeId);
    if (filters.creativeSizeVariantId) params.set('creativeSizeVariantId', filters.creativeSizeVariantId);

    Promise.all([
      fetch(`/v1/tags/${tag.id}/summary?${params.toString()}`, { credentials: 'include' }).then(r => {
        if (!r.ok) throw new Error('Failed to load summary');
        return r.json();
      }),
      fetch(`/v1/tags/${tag.id}/stats?${params.toString()}`, { credentials: 'include' }).then(r => {
        if (!r.ok) throw new Error('Failed to load stats');
        return r.json();
      }),
    ])
      .then(([sumData, statData]) => {
        setSummary(normalizeTagSummary(sumData?.summary ?? sumData ?? null));
        setStats(normalizeDailyStats(statData?.stats ?? statData ?? []));
      })
      .catch(() => setStatsError('Failed to load tag statistics.'))
      .finally(() => setLoadingStats(false));
  }, []);

  useEffect(() => {
    if (selectedTag) {
      loadTagData(selectedTag, dateRange, {
        creativeId: selectedCreativeId,
        creativeSizeVariantId: selectedVariantId,
      });
    }
  }, [selectedTag, dateRange, selectedCreativeId, selectedVariantId, loadTagData]);

  const handleExport = useCallback(async () => {
    if (!selectedTag || !summary) return;
    setExporting(true);
    try {
      const XLSX = await import('xlsx');
      const workbook = XLSX.utils.book_new();

      const filterSummary = [
        { Filter: 'Tag', Value: selectedTag.name },
        { Filter: 'Date Range', Value: `Last ${dateRange} days` },
        { Filter: 'Assigned Creative', Value: creativeOptions.find(option => option.id === selectedCreativeId)?.name ?? 'All' },
        { Filter: 'Creative Size', Value: variantOptions.find(option => option.id === selectedVariantId)?.name ?? 'All' },
      ];
      const summaryRows = [
        { Metric: 'Total Impressions', Value: summary.totalImpressions },
        { Metric: 'Total Clicks', Value: summary.totalClicks },
        { Metric: 'CTR (%)', Value: Number(summary.ctr.toFixed(2)) },
        { Metric: 'Viewability (%)', Value: Number(summary.viewabilityRate.toFixed(2)) },
        { Metric: 'In-View Time (ms)', Value: summary.totalInViewDurationMs },
        { Metric: 'Attention Time (ms)', Value: summary.totalAttentionDurationMs },
        { Metric: 'Last 7d Impressions', Value: summary.impressionsLast7d },
        { Metric: 'Video Starts', Value: summary.videoStarts },
        { Metric: 'Start Rate (%)', Value: Number(summary.videoStartRate.toFixed(2)) },
        { Metric: 'Plays Completed', Value: summary.videoCompletions },
        { Metric: 'Completion Rate (%)', Value: Number(summary.videoCompletionRate.toFixed(2)) },
      ];
      const contextRows = summary.latestContext
        ? [
            { Field: 'Site Domain', Value: summary.latestContext.siteDomain || 'n/a' },
            { Field: 'Page URL', Value: summary.latestContext.pageUrl || 'n/a' },
            { Field: 'Country', Value: summary.latestContext.country || 'n/a' },
            { Field: 'Region', Value: summary.latestContext.region || 'n/a' },
            { Field: 'City', Value: summary.latestContext.city || 'n/a' },
            { Field: 'Device Type', Value: summary.latestContext.deviceType || 'n/a' },
            { Field: 'Device Model', Value: summary.latestContext.deviceModel || 'n/a' },
            { Field: 'Browser', Value: summary.latestContext.browser || 'n/a' },
            { Field: 'OS', Value: summary.latestContext.os || 'n/a' },
            { Field: 'Contextual IDs', Value: summary.latestContext.contextualIds || 'n/a' },
            { Field: 'Network ID', Value: summary.latestContext.networkId || 'n/a' },
            { Field: 'Source Publisher ID', Value: summary.latestContext.sourcePublisherId || 'n/a' },
            { Field: 'App ID', Value: summary.latestContext.appId || 'n/a' },
            { Field: 'Site ID', Value: summary.latestContext.siteId || 'n/a' },
            { Field: 'Exchange ID', Value: summary.latestContext.exchangeId || 'n/a' },
            { Field: 'Exchange Publisher ID', Value: summary.latestContext.exchangePublisherId || 'n/a' },
            { Field: 'Exchange Site/Domain', Value: summary.latestContext.exchangeSiteIdOrDomain || 'n/a' },
            { Field: 'App Bundle', Value: summary.latestContext.appBundle || 'n/a' },
            { Field: 'App Name', Value: summary.latestContext.appName || 'n/a' },
            { Field: 'Page Position', Value: summary.latestContext.pagePosition || 'n/a' },
            { Field: 'Content Language', Value: summary.latestContext.contentLanguage || 'n/a' },
            { Field: 'Content Title', Value: summary.latestContext.contentTitle || 'n/a' },
            { Field: 'Content Series', Value: summary.latestContext.contentSeries || 'n/a' },
            { Field: 'Carrier', Value: summary.latestContext.carrier || 'n/a' },
            { Field: 'App Store Name', Value: summary.latestContext.appStoreName || 'n/a' },
            { Field: 'Content Genre', Value: summary.latestContext.contentGenre || 'n/a' },
          ]
        : [];
      const breakdownRows = [...stats]
        .reverse()
        .map(row => {
          const ctr = row.impressions > 0 ? (row.clicks / row.impressions) * 100 : 0;
          const startRate = row.impressions > 0 ? (row.videoStarts / row.impressions) * 100 : 0;
          const completionRate = row.videoStarts > 0 ? (row.videoCompletions / row.videoStarts) * 100 : 0;
          return {
            Date: row.date,
            Impressions: row.impressions,
            Clicks: row.clicks,
            'Play Starts': row.videoStarts,
            'Plays Completed': row.videoCompletions,
            'CTR (%)': Number(ctr.toFixed(2)),
            'Start Rate (%)': Number(startRate.toFixed(2)),
            'Completion Rate (%)': Number(completionRate.toFixed(2)),
          };
        });

      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(filterSummary), 'Filters');
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(summaryRows), 'Summary');
      if (contextRows.length) {
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(contextRows), 'Latest Context');
      }
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(breakdownRows), 'Daily Breakdown');
      XLSX.writeFile(workbook, `${slugify(selectedTag.name)}-report.xlsx`);
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
