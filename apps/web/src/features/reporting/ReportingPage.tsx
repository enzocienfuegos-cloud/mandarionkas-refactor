import React, { useMemo, useState } from 'react';
import { displayCampaignRows } from './reporting.mock';
import { reportingModeConfig } from './reporting.config';
import type { ReportingMode } from './reporting.types';
import { KpiGrid } from './components/KpiGrid';
import { ReportingHeader } from './components/ReportingHeader';
import { ReportingShell } from './components/ReportingShell';
import { ReportingTopBar } from './components/ReportingTopBar';
import { ScopeBar } from './components/ScopeBar';
import { WidgetRenderer } from './components/WidgetRenderer';

export function ReportingPage() {
  const [mode, setMode] = useState<ReportingMode>('all');
  const [advertiserFilter, setAdvertiserFilter] = useState('');
  const [dateRangeFilter, setDateRangeFilter] = useState<'7d' | '30d' | '90d' | 'custom'>('30d');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'paused' | 'archived'>('all');
  const [search, setSearch] = useState('');
  const config = reportingModeConfig[mode];

  const widgets = useMemo(
    () => config.widgets.slice().sort((a, b) => a.order - b.order),
    [config.widgets],
  );
  const advertiserOptions = useMemo(
    () => [...new Set(displayCampaignRows.map((row) => row.name.split(' · ')[0]?.trim()).filter(Boolean))].map((value) => ({ value, label: value })),
    [],
  );

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
      <ScopeBar mode={mode} />
      <KpiGrid kpis={config.kpis} />
      <WidgetRenderer widgets={widgets} mode={mode} />
    </ReportingShell>
  );
}
