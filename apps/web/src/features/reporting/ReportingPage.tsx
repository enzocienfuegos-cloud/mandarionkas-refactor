import React, { useMemo, useState } from 'react';
import { Button, CenteredSpinner, Panel } from '../../system';
import { reportingModeConfig } from './reporting.config';
import type { ReportingMode } from './reporting.types';
import { KpiGrid } from './components/KpiGrid';
import { ReportingHeader } from './components/ReportingHeader';
import { ReportingShell } from './components/ReportingShell';
import { ReportingTopBar } from './components/ReportingTopBar';
import { ScopeBar } from './components/ScopeBar';
import { WidgetRenderer } from './components/WidgetRenderer';
import { useReportingData } from './hooks/useReportingData';

export function ReportingPage() {
  const [mode, setMode] = useState<ReportingMode>('all');
  const [advertiserFilter, setAdvertiserFilter] = useState('');
  const [dateRangeFilter, setDateRangeFilter] = useState<'7d' | '30d' | '90d' | 'custom'>('30d');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'paused' | 'archived'>('all');
  const [search, setSearch] = useState('');
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
    advertiserId: advertiserFilter,
    statusFilter,
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
    if (dateRangeFilter === '7d') return 'Last 7 days';
    if (dateRangeFilter === '90d') return 'Last 90 days';
    if (dateRangeFilter === 'custom') return 'Custom range';
    return 'Last 30 days';
  }, [dateRangeFilter]);

  return (
    <ReportingShell>
      <ReportingTopBar
        advertiserFilter={advertiserFilter}
        advertiserOptions={advertiserOptions}
        onAdvertiserChange={setAdvertiserFilter}
        dateRangeFilter={dateRangeFilter}
        onDateRangeChange={setDateRangeFilter}
        statusFilter={statusFilter}
        onStatusChange={setStatusFilter}
        search={search}
        onSearchChange={setSearch}
        onResetFilters={() => {
          setAdvertiserFilter('');
          setDateRangeFilter('30d');
          setStatusFilter('all');
          setSearch('');
        }}
      />
      <ReportingHeader mode={mode} config={config} onModeChange={setMode} />
      <ScopeBar mode={mode} scopeLabel={selectedAdvertiserLabel} dateRangeLabel={dateRangeLabel} />
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
