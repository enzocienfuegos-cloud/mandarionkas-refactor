import React from 'react';
import { Badge, Button, FormField, Input, Kicker, MetricCard, Panel, Select } from '../../system';
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
        <Button
          type="button"
          onClick={onUploadCreative}
          variant="primary"
          className="min-h-[46px] px-5"
        >
          Upload creative
        </Button>
      </div>

      <header className="grid gap-6 xl:grid-cols-[1.4fr_1fr] xl:items-end">
        <div>
          <div className="mb-4 flex items-center gap-2">
            <Badge tone="brand" variant="soft">Creatives</Badge>
            <Badge tone="neutral" variant="outline">Creative QA workspace</Badge>
          </div>
          <h1 className="text-4xl font-semibold tracking-tight text-text-primary md:text-5xl">Creative approval without trafficking gaps</h1>
          <p className="mt-3 max-w-3xl text-lg leading-8 text-text-muted">Review specs, preview assets, catch blockers and approve creatives from one dense operational view with the same CM360-style workspace pattern.</p>
        </div>
        <Panel className="p-5">
          <Kicker>Recommended focus</Kicker>
          <div className="mt-4 flex items-start gap-3 rounded-2xl border border-[color:var(--dusk-status-warning-border)] bg-[color:var(--dusk-status-warning-bg)] p-4">
            <AlertTriangleIcon className="text-[color:var(--dusk-status-warning-fg)]" />
            <div>
              <p className="font-semibold text-[color:var(--dusk-status-warning-fg)]">{pendingReviewCount} creatives need QA review</p>
              <p className="mt-1 text-sm text-[color:var(--dusk-status-warning-fg)]/80">Review clicktags, specs, missing assets and rejected creatives before launch or trafficking handoff.</p>
            </div>
          </div>
        </Panel>
      </header>

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
