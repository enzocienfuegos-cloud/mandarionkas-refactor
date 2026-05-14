import React from 'react';
import { EmptyState } from '../../../system';
import type { ReportingMode, WidgetConfig, WidgetSize } from '../reporting.types';
import type { ReportingDataViewModel } from '../hooks/useReportingData';
import { ConnectionBreakdown } from './ConnectionBreakdown';
import { DeviceBreakdown } from './DeviceBreakdown';
import { DisplayTable } from './DisplayTable';
import { IdentityInsights } from './IdentityInsights';
import { IdentityMethodology } from './IdentityMethodology';
import { InventorySources } from './InventorySources';
import { TopCreatives } from './TopCreatives';
import { TopRegions } from './TopRegions';
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
      {rows.length ? (
        <div className="space-y-3">
          {rows.map((row) => (
            <div key={row.label} className="rounded-2xl border border-[color:var(--dusk-border-subtle)] bg-[color:var(--dusk-surface-muted)] px-3 py-3">
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold text-[color:var(--dusk-text-primary)]">{row.label}</p>
                <span className="text-sm font-bold text-[color:var(--dusk-text-primary)]">{row.value}</span>
              </div>
              <p className="mt-1 text-xs text-[color:var(--dusk-text-soft)]">{row.helper}</p>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No data in scope"
          description="Adjust the filters or widen the date range to populate this reporting widget."
        />
      )}
    </WidgetPanel>
  );
}

function WidgetByType({
  widget,
  mode,
  data,
}: {
  widget: WidgetConfig;
  mode: ReportingMode;
  data: ReportingDataViewModel;
}) {
  switch (widget.type) {
    case 'trend':
      return <TrendChart title={widget.title} tone={mode === 'video' ? 'blue' : mode === 'identity' ? 'emerald' : 'fuchsia'} series={data.trend} />;
    case 'displayTable':
    case 'campaignPerformance':
      return <DisplayTable title={widget.title} rows={data.campaignRows} icon="campaign" />;
    case 'tagPerformance':
      return <DisplayTable title={widget.title} rows={data.tagRows} icon="tag" />;
    case 'creativePerformance':
      return <DisplayTable title={widget.title} rows={data.creativeRows} icon="creative" />;
    case 'variantPerformance':
      return <DisplayTable title={widget.title} rows={data.variantRows} icon="creative" />;
    case 'videoFunnel':
      return <VideoFunnel rows={data.videoFunnel} />;
    case 'videoFormat':
      return <VideoFormatDonut rows={data.videoFormatRows} />;
    case 'identityInsights':
      return <IdentityInsights rows={data.identitySegments} />;
    case 'identityMethodology':
      return <IdentityMethodology />;
    case 'identityFrequency':
      return (
        <GenericInfoPanel
          title={widget.title}
          icon="identity"
          tone="emerald"
          rows={data.identityFrequencyRows.map((row) => ({ label: row.bucket, value: row.ctr, helper: `${row.identities.toLocaleString()} identities · ${row.impressions.toLocaleString()} imps · ${row.clicks.toLocaleString()} clicks` }))}
        />
      );
    case 'identityKeys':
      return (
        <GenericInfoPanel
          title={widget.title}
          icon="identity"
          tone="emerald"
          rows={data.identityKeyRows}
        />
      );
    case 'identityAttribution':
      return (
        <GenericInfoPanel
          title={widget.title}
          icon="tracker"
          tone="emerald"
          rows={data.attributionWindowRows.map((row) => ({ label: row.label, value: row.value, helper: row.helper }))}
        />
      );
    case 'audienceExport':
      return (
        <GenericInfoPanel
          title={widget.title}
          icon="identity"
          tone="emerald"
          rows={data.audienceExportRows}
        />
      );
    case 'topSites':
      return <InventorySources rows={data.inventorySourceRows} kind="Domain" />;
    case 'topApps':
      return <InventorySources rows={data.inventorySourceRows} kind="App" />;
    case 'deviceBreakdown':
      return <DeviceBreakdown rows={data.deviceRows} />;
    case 'connectionBreakdown':
      return <ConnectionBreakdown rows={data.connectionRows} />;
    case 'topRegions':
      return <TopRegions rows={data.topRegions} />;
    case 'topCreatives':
      return <TopCreatives mode={mode} rows={data.topCreatives} />;
    default:
      return null;
  }
}

export function WidgetRenderer({
  widgets,
  mode,
  data,
}: {
  widgets: WidgetConfig[];
  mode: ReportingMode;
  data: ReportingDataViewModel;
}) {
  return (
    <section className="grid gap-3 xl:grid-cols-12">
      {widgets
        .filter((widget) => widget.visibleIn.includes(mode))
        .map((widget) => (
          <div key={widget.id} className={widgetSizeClass[widget.size]}>
            <WidgetByType widget={widget} mode={mode} data={data} />
          </div>
        ))}
    </section>
  );
}
