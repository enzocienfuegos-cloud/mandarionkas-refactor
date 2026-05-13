import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getSavedView } from '../../shared/saved-views';
import {
  Button,
  CenteredSpinner,
  Panel,
  SavedViewsMenu,
  type DateRange,
} from '../../system';
import { reportingModeConfig } from './reporting.config';
import type { ReportingMode, SpendView } from './reporting.types';
import { KpiGrid } from './components/KpiGrid';
import { ReportingHeader } from './components/ReportingHeader';
import { ReportingShell } from './components/ReportingShell';
import { ReportingTopBar } from './components/ReportingTopBar';
import { ScopeBar } from './components/ScopeBar';
import { WidgetRenderer } from './components/WidgetRenderer';
import { useReportingData, type DateRangeFilter, type TimeGranularity } from './hooks/useReportingData';

function formatDateLabel(value: Date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(value);
}

function createDefaultCustomDateRange(): DateRange {
  const today = new Date();
  const from = new Date(today);
  from.setDate(today.getDate() - 29);
  return { from, to: today };
}

function serializeDateRange(range: DateRange) {
  return {
    from: range.from ? range.from.toISOString() : null,
    to: range.to ? range.to.toISOString() : null,
  };
}

function parseDateRange(value: unknown): DateRange {
  if (!value || typeof value !== 'object') {
    return createDefaultCustomDateRange();
  }

  const source = value as { from?: unknown; to?: unknown };
  const from = typeof source.from === 'string' ? new Date(source.from) : null;
  const to = typeof source.to === 'string' ? new Date(source.to) : null;

  return {
    from: from && !Number.isNaN(from.getTime()) ? from : null,
    to: to && !Number.isNaN(to.getTime()) ? to : null,
  };
}

function formatTimezoneLabel(value: string) {
  if (value === 'America/El_Salvador') return 'CST';
  if (value === 'UTC') return 'UTC';
  return value.replace('America/', '').replace('Europe/', '').replace(/_/g, ' ');
}

export function ReportingPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [mode, setMode] = useState<ReportingMode>('all');
  const [advertiserFilter, setAdvertiserFilter] = useState('');
  const [dateRangeFilter, setDateRangeFilter] = useState<DateRangeFilter>('30d');
  const [customDateRange, setCustomDateRange] = useState<DateRange>(() => createDefaultCustomDateRange());
  const [timeGranularity, setTimeGranularity] = useState<TimeGranularity>('day');
  const [timezone, setTimezone] = useState('America/El_Salvador');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'paused' | 'archived'>('all');
  const [spendView, setSpendView] = useState<SpendView>('without_margin');
  const [search, setSearch] = useState('');
  const currentViewId = searchParams.get('view');
  const config = reportingModeConfig[mode];
  const {
    advertiserOptions,
    kpis,
    loading,
    error,
    reload,
    ...reportingData
  } = useReportingData({
    mode,
    dateRange: dateRangeFilter,
    customDateRange,
    timeGranularity,
    timezone,
    advertiserId: advertiserFilter,
    statusFilter,
    spendView,
    search,
  });

  const widgets = useMemo(
    () => config.widgets.slice().sort((a, b) => a.order - b.order),
    [config.widgets],
  );
  const selectedAdvertiserLabel = useMemo(
    () => advertiserOptions.find((option) => option.value === advertiserFilter)?.label ?? 'Current workspace',
    [advertiserFilter, advertiserOptions],
  );
  const dateRangeLabel = useMemo(() => {
    if (dateRangeFilter === 'today') return 'Today';
    if (dateRangeFilter === 'yesterday') return 'Yesterday';
    if (dateRangeFilter === '7d') return 'Last 7 days';
    if (dateRangeFilter === '90d') return 'Last 90 days';
    if (dateRangeFilter === 'custom') {
      if (customDateRange.from && customDateRange.to) {
        return `${formatDateLabel(customDateRange.from)} - ${formatDateLabel(customDateRange.to)}`;
      }
      return 'Custom range';
    }
    return 'Last 30 days';
  }, [customDateRange.from, customDateRange.to, dateRangeFilter]);

  useEffect(() => {
    if (!currentViewId) return;
    let cancelled = false;
    void getSavedView(currentViewId)
      .then((view) => {
        if (cancelled) return;
        if (!view || view.surface !== 'reporting') {
          setSearchParams((params) => {
            const next = new URLSearchParams(params);
            next.delete('view');
            return next;
          });
          return;
        }
        const nextFilters = view.filters ?? {};
        setMode((['all', 'display', 'video', 'identity'].includes(String(nextFilters.mode))
          ? nextFilters.mode
          : 'all') as ReportingMode);
        setAdvertiserFilter(String(nextFilters.advertiserFilter ?? ''));
        setDateRangeFilter((['today', 'yesterday', '7d', '30d', '90d', 'custom'].includes(String(nextFilters.dateRangeFilter))
          ? nextFilters.dateRangeFilter
          : '30d') as DateRangeFilter);
        setCustomDateRange(parseDateRange(nextFilters.customDateRange));
        setTimeGranularity((['day', 'hour'].includes(String(nextFilters.timeGranularity))
          ? nextFilters.timeGranularity
          : 'day') as TimeGranularity);
        setTimezone(String(nextFilters.timezone ?? 'America/El_Salvador') || 'America/El_Salvador');
        setStatusFilter((['all', 'active', 'paused', 'archived'].includes(String(nextFilters.statusFilter))
          ? nextFilters.statusFilter
          : 'all') as 'all' | 'active' | 'paused' | 'archived');
        setSpendView((['without_margin', 'with_margin'].includes(String(nextFilters.spendView))
          ? nextFilters.spendView
          : 'without_margin') as SpendView);
        setSearch(String(nextFilters.search ?? ''));
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
  }, [currentViewId, setSearchParams]);

  return (
    <ReportingShell>
      <ReportingTopBar
        secondaryAction={(
          <SavedViewsMenu
            surface="reporting"
            currentFilters={{
              mode,
              advertiserFilter,
              dateRangeFilter,
              customDateRange: serializeDateRange(customDateRange),
              timeGranularity,
              timezone,
              statusFilter,
              spendView,
              search,
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
        advertiserFilter={advertiserFilter}
        advertiserOptions={advertiserOptions}
        onAdvertiserChange={setAdvertiserFilter}
        dateRangeFilter={dateRangeFilter}
        onDateRangeChange={setDateRangeFilter}
        customDateRange={customDateRange}
        onCustomDateRangeChange={setCustomDateRange}
        timeGranularity={timeGranularity}
        onTimeGranularityChange={setTimeGranularity}
        timezone={timezone}
        onTimezoneChange={setTimezone}
        statusFilter={statusFilter}
        onStatusChange={setStatusFilter}
        spendView={spendView}
        onSpendViewChange={setSpendView}
        search={search}
        onSearchChange={setSearch}
        onRefresh={() => {
          void reload();
        }}
        refreshing={loading}
        onResetFilters={() => {
          setAdvertiserFilter('');
          setDateRangeFilter('30d');
          setCustomDateRange(createDefaultCustomDateRange());
          setTimeGranularity('day');
          setTimezone('America/El_Salvador');
          setStatusFilter('all');
          setSpendView('without_margin');
          setSearch('');
        }}
      />
      <ReportingHeader mode={mode} config={config} onModeChange={setMode} />
      <ScopeBar
        mode={mode}
        scopeLabel={selectedAdvertiserLabel}
        dateRangeLabel={dateRangeLabel}
        timeScopeLabel={`${timeGranularity === 'hour' ? 'Hourly' : 'Daily'} · ${formatTimezoneLabel(timezone)}`}
        spendViewLabel={spendView === 'with_margin' ? 'With margin' : 'Without margin'}
      />
      {loading && !kpis.length ? <CenteredSpinner label="Loading reporting workspace…" /> : null}
      {error ? (
        <Panel elevation={2} padding="md" className="border-[color:var(--dusk-status-critical-border)] bg-[color:var(--dusk-status-critical-bg)]">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-semibold text-[color:var(--dusk-text-primary)]">Couldn&apos;t load reporting data</p>
              <p className="text-sm text-[color:var(--dusk-status-critical-fg)]">{error}</p>
            </div>
            <Button type="button" variant="secondary" onClick={reload}>Retry</Button>
          </div>
        </Panel>
      ) : null}
      <KpiGrid kpis={kpis} mode={mode} />
      <WidgetRenderer widgets={widgets} mode={mode} data={reportingData} />
    </ReportingShell>
  );
}
