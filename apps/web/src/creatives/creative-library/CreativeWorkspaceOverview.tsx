import React from 'react';
import { Badge, Button, FormField, Input, Kicker, MetricCard, PageHeader, Select } from '../../system';
import type { Metric } from './types';
import {
  AlertTriangleIcon,
  CreativeIcon,
  mapMetricTone,
  ReportIcon,
  SearchIcon,
  TableIcon,
} from './ui';

type WorkspaceOptionLike = {
  id: string;
  name: string;
};

type Props = {
  workspaces: WorkspaceOptionLike[];
  selectedWorkspaceId: string;
  onWorkspaceChange: (workspaceId: string) => void;
  needsQaOnly: boolean;
  onToggleNeedsQa: () => void;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  onUploadCreative: () => void;
  pendingReviewCount: number;
  creativeMetrics: Metric[];
};

export function CreativeWorkspaceOverview({
  workspaces,
  selectedWorkspaceId,
  onWorkspaceChange,
  needsQaOnly,
  onToggleNeedsQa,
  searchTerm,
  onSearchChange,
  onUploadCreative,
  pendingReviewCount,
  creativeMetrics,
}: Props) {
  return (
    <>
      <PageHeader
        kicker="Creatives · Creative QA workspace"
        title="Creatives"
        meta={`${pendingReviewCount} pending review · asset approval and trafficking workspace`}
        primaryAction={(
          <Button
            type="button"
            onClick={onUploadCreative}
            variant="primary"
            className="min-h-[46px] px-5"
          >
            Upload creative
          </Button>
        )}
        alert={(
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <AlertTriangleIcon className="mt-0.5 shrink-0" />
              <p className="text-sm font-medium">
                {pendingReviewCount} creatives need QA review before trafficking handoff.
              </p>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={onToggleNeedsQa} className="shrink-0">
              Filter to QA queue
            </Button>
          </div>
        )}
      />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-wrap items-end gap-3">
          <FormField label="Advertiser" className="min-w-[220px]">
            <Select
              value={selectedWorkspaceId}
              onChange={(event) => onWorkspaceChange(event.target.value)}
              className="min-h-[46px]"
              options={[
                { value: '', label: 'All advertisers' },
                ...workspaces.map((workspace) => ({ value: workspace.id, label: workspace.name })),
              ]}
            />
          </FormField>
          <Button
            type="button"
            onClick={onToggleNeedsQa}
            variant="secondary"
            className="min-h-[46px]"
          >
            Needs QA
            {needsQaOnly ? <Badge tone="brand" size="sm">On</Badge> : null}
          </Button>
          <FormField label="Search" className="min-w-[320px]">
            <Input
              value={searchTerm}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Search creative, advertiser, campaign"
              className="min-h-[46px]"
              leadingIcon={<SearchIcon />}
            />
          </FormField>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-4">
        {creativeMetrics.map((metric) => (
          <MetricCard
            key={metric.id}
            label={metric.label}
            value={metric.value}
            delta={metric.delta}
            trend={metric.direction}
            context={metric.helper}
            series={metric.series}
            tone={mapMetricTone(metric.tone)}
            icon={
              metric.id === 'creative-health'
                ? <CreativeIcon />
                : metric.id === 'creative-approved'
                  ? <ReportIcon />
                  : metric.id === 'creative-blocked'
                    ? <AlertTriangleIcon />
                    : <TableIcon />
            }
          />
        ))}
      </div>
    </>
  );
}
