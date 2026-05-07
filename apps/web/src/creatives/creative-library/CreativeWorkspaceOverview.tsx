import React from 'react';
import { Button, ConfigurableMetricStrip, FilterBar, PageHeader } from '../../system';
import { creativeMetricScope } from '../creative.metrics';
import {
  AlertTriangleIcon,
} from './ui';

type WorkspaceOptionLike = {
  id: string;
  name: string;
};

type Props = {
  secondaryActions?: React.ReactNode;
  workspaces: WorkspaceOptionLike[];
  selectedWorkspaceId: string;
  onWorkspaceChange: (workspaceId: string) => void;
  statusFilter: 'all' | 'active' | 'inactive' | 'pending_review' | 'rejected';
  onStatusFilterChange: (value: 'all' | 'active' | 'inactive' | 'pending_review' | 'rejected') => void;
  formatFilter: 'all' | 'video' | 'display' | 'native';
  onFormatFilterChange: (value: 'all' | 'video' | 'display' | 'native') => void;
  sizeFilter: string;
  onSizeFilterChange: (value: string) => void;
  sizeOptions: string[];
  searchTerm: string;
  onSearchChange: (value: string) => void;
  onUploadCreative: () => void;
  pendingReviewCount: number;
  creativeMetricData: {
    creativeEligibility: number;
    pendingQaCreatives: number;
    approvedCreatives: number;
    rejectedCreatives: number;
    missingCreatives: number;
    filteredCreativeCount: number;
  };
};

export function CreativeWorkspaceOverview({
  secondaryActions,
  workspaces,
  selectedWorkspaceId,
  onWorkspaceChange,
  statusFilter,
  onStatusFilterChange,
  formatFilter,
  onFormatFilterChange,
  sizeFilter,
  onSizeFilterChange,
  sizeOptions,
  searchTerm,
  onSearchChange,
  onUploadCreative,
  pendingReviewCount,
  creativeMetricData,
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
        secondaryActions={secondaryActions}
        alert={(
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <AlertTriangleIcon className="mt-0.5 shrink-0" />
              <p className="text-sm font-medium">
                {pendingReviewCount} creatives need QA review before trafficking handoff.
              </p>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={() => onStatusFilterChange('pending_review')} className="shrink-0">
              Filter to QA queue
            </Button>
          </div>
        )}
      />

      <FilterBar
        pills={[
          {
            id: 'advertiser',
            label: 'Advertiser',
            value: selectedWorkspaceId,
            options: [
              { value: '', label: 'All advertisers' },
              ...workspaces.map((workspace) => ({ value: workspace.id, label: workspace.name })),
            ],
            onChange: onWorkspaceChange,
          },
          {
            id: 'status',
            label: 'Status',
            value: statusFilter,
            options: [
              { value: 'all', label: 'All creatives' },
              { value: 'pending_review', label: 'Needs QA' },
              { value: 'active', label: 'Active' },
              { value: 'inactive', label: 'Inactive' },
              { value: 'rejected', label: 'Rejected' },
            ],
            onChange: (value) => onStatusFilterChange(value as 'all' | 'active' | 'inactive' | 'pending_review' | 'rejected'),
          },
          {
            id: 'format',
            label: 'Format',
            value: formatFilter,
            options: [
              { value: 'all', label: 'All formats' },
              { value: 'video', label: 'Video' },
              { value: 'display', label: 'Display' },
              { value: 'native', label: 'Native' },
            ],
            onChange: (value) => onFormatFilterChange(value as 'all' | 'video' | 'display' | 'native'),
          },
          {
            id: 'size',
            label: 'Size',
            value: sizeFilter,
            options: [
              { value: 'all', label: 'All sizes' },
              ...sizeOptions.map((option) => ({ value: option, label: option })),
            ],
            onChange: onSizeFilterChange,
          },
        ]}
        search={{
          value: searchTerm,
          onChange: onSearchChange,
          placeholder: 'Search creative, advertiser, campaign',
        }}
        activeFilterCount={[selectedWorkspaceId, statusFilter !== 'all', formatFilter !== 'all', sizeFilter !== 'all', searchTerm.trim()].filter(Boolean).length}
        onResetAll={() => {
          onWorkspaceChange('');
          onStatusFilterChange('all');
          onFormatFilterChange('all');
          onSizeFilterChange('all');
          onSearchChange('');
        }}
      />

      <ConfigurableMetricStrip scope={creativeMetricScope} data={creativeMetricData} />
    </>
  );
}
