import type { MetricScope } from '../../system/metrics/registry';
import type { ReportingKpi, ReportingMode } from './reporting.types';

type ReportingMetricSource = {
  mode: ReportingMode;
  kpis: ReportingKpi[];
};

function toneMap(tone: ReportingKpi['tone']) {
  if (tone === 'fuchsia') return 'brand' as const;
  if (tone === 'emerald') return 'success' as const;
  if (tone === 'amber') return 'warning' as const;
  if (tone === 'rose') return 'critical' as const;
  if (tone === 'blue' || tone === 'cyan' || tone === 'violet') return 'info' as const;
  return 'neutral' as const;
}

function iconMap(icon: string) {
  if (icon === 'impressions' || icon === 'campaign' || icon === 'tag') return 'impressions' as const;
  if (icon === 'clicks' || icon === 'ctr') return 'ctr' as const;
  if (icon === 'attention') return 'engagements' as const;
  if (icon === 'viewability' || icon === 'identity' || icon === 'tracker' || icon === 'video') return 'viewability' as const;
  return 'spend' as const;
}

export function createReportingMetricScope(mode: ReportingMode, defaultIds: string[]): MetricScope<ReportingMetricSource> {
  return {
    id: `reporting-${mode}`,
    defaultIds,
    metrics: defaultIds.map((id) => ({
      id,
      label: id,
      group: 'Reporting',
      tone: 'info',
      compute: ({ kpis }) => {
        const item = kpis.find((kpi) => kpi.id === id);
        if (!item) return null;
        return {
          id: item.id,
          label: item.label,
          value: item.value,
          delta: item.delta,
          direction: item.direction,
          context: item.helper ?? item.comparisonLabel,
          series: item.sparkline,
          tone: toneMap(item.tone),
          icon: iconMap(item.icon),
        };
      },
    })),
  };
}
