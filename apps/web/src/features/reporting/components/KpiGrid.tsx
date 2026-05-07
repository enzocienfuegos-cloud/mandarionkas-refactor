import React from 'react';
import { ConfigurableMetricStrip } from '../../../system';
import { createReportingMetricScope } from '../reporting.metrics';
import type { ReportingKpi, ReportingMode } from '../reporting.types';

export function KpiGrid({ kpis, mode }: { kpis: ReportingKpi[]; mode: ReportingMode }) {
  return (
    <section>
      <ConfigurableMetricStrip
        scope={createReportingMetricScope(mode, kpis.slice(0, Math.min(6, kpis.length)).map((item) => item.id))}
        data={{ mode, kpis }}
      />
    </section>
  );
}
