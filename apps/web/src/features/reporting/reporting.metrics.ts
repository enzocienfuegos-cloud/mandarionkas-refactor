import type { MetricDefinition, MetricScope } from '../../system/metrics/registry';
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

export function createReportingMetricScope(mode: ReportingMode, kpis: ReportingKpi[]): MetricScope<ReportingMetricSource> {
  const defaultIds = kpis.slice(0, Math.min(6, kpis.length)).map((item) => item.id);
  const definitions: MetricDefinition<ReportingMetricSource>[] = kpis.map((metric) => ({
    id: metric.id,
    label: metric.label,
    group: 'Reporting',
    tone: toneMap(metric.tone),
    icon: iconMap(metric.icon),
    compute: ({ kpis: items }) => {
      const item = items.find((kpi) => kpi.id === metric.id);
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
  }));

  return {
    id: `reporting-${mode}`,
    defaultIds,
    metrics: definitions,
  };
}
