import React from 'react';
import { Button, Input, Kicker, MetricCard, Panel, Select } from '../../system';
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
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <Select
            value={selectedWorkspaceId}
            onChange={(event) => onWorkspaceChange(event.target.value)}
            className="min-h-[46px] min-w-[220px]"
            options={[
              { value: '', label: 'All advertisers' },
              ...workspaces.map((workspace) => ({ value: workspace.id, label: workspace.name })),
            ]}
          />
          <Button
            type="button"
            onClick={onToggleNeedsQa}
            variant="secondary"
            className={needsQaOnly ? 'min-h-[46px] border-fuchsia-300 bg-fuchsia-50 text-fuchsia-700 dark:border-fuchsia-500/24 dark:bg-fuchsia-500/10 dark:text-fuchsia-300' : 'min-h-[46px]'}
          >
            Needs QA
          </Button>
          <label className="relative block min-w-[320px]">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-white/40"><SearchIcon /></span>
            <Input
              value={searchTerm}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Search creative, advertiser, campaign"
              className="min-h-[46px] pl-10"
            />
          </label>
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
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-fuchsia-200 bg-fuchsia-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.22em] text-fuchsia-700 dark:border-fuchsia-500/15 dark:bg-fuchsia-500/10 dark:text-fuchsia-300">
            Creatives
            <span className="h-1 w-1 rounded-full bg-current opacity-60" />
            Creative QA workspace
          </div>
          <h1 className="text-4xl font-semibold tracking-tight text-slate-950 dark:text-white md:text-5xl">Creative approval without trafficking gaps</h1>
          <p className="mt-3 max-w-3xl text-lg leading-8 text-slate-600 dark:text-white/62">Review specs, preview assets, catch blockers and approve creatives from one dense operational view with the same CM360-style workspace pattern.</p>
        </div>
        <Panel className="p-5">
          <Kicker>Recommended focus</Kicker>
          <div className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/18 dark:bg-amber-500/10">
            <AlertTriangleIcon className="text-amber-600 dark:text-amber-300" />
            <div>
              <p className="font-semibold text-amber-800 dark:text-amber-100">{pendingReviewCount} creatives need QA review</p>
              <p className="mt-1 text-sm text-amber-700/72 dark:text-amber-100/62">Review clicktags, specs, missing assets and rejected creatives before launch or trafficking handoff.</p>
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
