import React from 'react';
import { ConfigurableMetricStrip } from '../../../system';
import { createReportingMetricScope } from '../reporting.metrics';
import type { ReportingKpi, ReportingMode } from '../reporting.types';

export function KpiGrid({ kpis, mode }: { kpis: ReportingKpi[]; mode: ReportingMode }) {
  return (
    <section>
      <ConfigurableMetricStrip
        scope={createReportingMetricScope(mode, kpis)}
        data={{ mode, kpis }}
      />
    </section>
  );
}
