import React from 'react';
import {
  attributionWindows,
  creativePerformanceRows,
  displayCampaignRows,
  identityFrequencyBuckets,
  tagPerformanceRows,
} from '../reporting.mock';
import type { ReportingMode, WidgetConfig, WidgetSize } from '../reporting.types';
import { DisplayTable } from './DisplayTable';
import { IdentityInsights } from './IdentityInsights';
import { RecommendationsPanel } from './RecommendationsPanel';
import { TopCreatives } from './TopCreatives';
import { TopRegions } from './TopRegions';
import { TrackerHealth } from './TrackerHealth';
import { TrendChart } from './TrendChart';
import { VideoFormatDonut } from './VideoFormatDonut';
import { VideoFunnel } from './VideoFunnel';
import { WidgetPanel } from './WidgetPanel';

const widgetSizeClass: Record<WidgetSize, string> = {
  small: 'xl:col-span-3',
  medium: 'xl:col-span-4',
  large: 'xl:col-span-6',
  wide: 'xl:col-span-8',
  full: 'xl:col-span-12',
};

function GenericInfoPanel({ title, icon, tone, rows }: { title: string; icon: 'identity' | 'tracker' | 'tag'; tone: 'emerald' | 'fuchsia'; rows: Array<{ label: string; value: string; helper: string }> }) {
  return (
    <WidgetPanel title={title} icon={icon} tone={tone}>
      <div className="space-y-3">
        {rows.map((row) => (
          <div key={row.label} className="rounded-2xl border border-white/8 bg-white/[0.025] px-3 py-3">
            <div className="flex items-center justify-between gap-3">
              <p className="font-semibold text-white">{row.label}</p>
              <span className="text-sm font-bold text-white">{row.value}</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">{row.helper}</p>
          </div>
        ))}
      </div>
    </WidgetPanel>
  );
}

function WidgetByType({ widget, mode }: { widget: WidgetConfig; mode: ReportingMode }) {
  switch (widget.type) {
    case 'trend':
      return <TrendChart mode={mode} />;
    case 'displayTable':
    case 'campaignPerformance':
      return <DisplayTable title={widget.title} rows={displayCampaignRows} icon="campaign" />;
    case 'tagPerformance':
      return <DisplayTable title={widget.title} rows={tagPerformanceRows} icon="tag" />;
    case 'creativePerformance':
      return <DisplayTable title={widget.title} rows={creativePerformanceRows} icon="creative" />;
    case 'videoFunnel':
      return <VideoFunnel />;
    case 'videoFormat':
      return <VideoFormatDonut />;
    case 'identityInsights':
      return <IdentityInsights />;
    case 'identityFrequency':
      return (
        <GenericInfoPanel
          title={widget.title}
          icon="identity"
          tone="emerald"
          rows={identityFrequencyBuckets.map((row) => ({ label: row.bucket, value: row.ctr, helper: `${row.identities.toLocaleString()} identities · ${row.impressions.toLocaleString()} imps · ${row.clicks.toLocaleString()} clicks` }))}
        />
      );
    case 'identityKeys':
      return (
        <GenericInfoPanel
          title={widget.title}
          icon="identity"
          tone="emerald"
          rows={[
            { label: 'Device ID', value: '48%', helper: 'dominant key across resolved events' },
            { label: 'Site Domain', value: '48%', helper: 'cross-context enrichment coverage' },
            { label: 'Email SHA256', value: '12%', helper: 'CRM-linked exportable subset' },
          ]}
        />
      );
    case 'identityAttribution':
      return (
        <GenericInfoPanel
          title={widget.title}
          icon="tracker"
          tone="emerald"
          rows={attributionWindows.map((row) => ({ label: row.label, value: row.value, helper: row.helper }))}
        />
      );
    case 'audienceExport':
      return (
        <GenericInfoPanel
          title={widget.title}
          icon="identity"
          tone="emerald"
          rows={[
            { label: 'Clicked users', value: 'Ready', helper: '18.6K users available for activation export' },
            { label: 'High-frequency exposed', value: 'Review', helper: '11.4K users may need suppression before export' },
            { label: 'Engaged non-clickers', value: 'Ready', helper: '12.2K users available for upper-funnel retargeting' },
          ]}
        />
      );
    case 'topRegions':
      return <TopRegions />;
    case 'topCreatives':
      return <TopCreatives mode={mode} />;
    case 'trackerHealth':
      return <TrackerHealth />;
    case 'recommendations':
      return <RecommendationsPanel mode={mode} />;
    default:
      return null;
  }
}

export function WidgetRenderer({ widgets, mode }: { widgets: WidgetConfig[]; mode: ReportingMode }) {
  return (
    <section className="grid gap-3 xl:grid-cols-12">
      {widgets
        .filter((widget) => widget.visibleIn.includes(mode))
        .map((widget) => (
          <div key={widget.id} className={widgetSizeClass[widget.size]}>
            <WidgetByType widget={widget} mode={mode} />
          </div>
        ))}
    </section>
  );
}
