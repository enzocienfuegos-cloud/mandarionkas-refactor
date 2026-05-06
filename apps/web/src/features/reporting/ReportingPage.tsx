import React, { useMemo, useState } from 'react';
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
  const config = reportingModeConfig[mode];

  const widgets = useMemo(
    () => config.widgets.slice().sort((a, b) => a.order - b.order),
    [config.widgets],
  );

  return (
    <ReportingShell>
      <ReportingTopBar />
      <ReportingHeader mode={mode} config={config} onModeChange={setMode} />
      <ScopeBar mode={mode} />
      <KpiGrid kpis={config.kpis} />
      <WidgetRenderer widgets={widgets} mode={mode} />
    </ReportingShell>
  );
}
