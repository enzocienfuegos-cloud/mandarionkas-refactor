import React from 'react';
import { Button, FilterBar } from '../../../system';
import { Settings } from '../../../system/icons';

export interface ReportingTopBarProps {
  secondaryAction?: React.ReactNode;
  advertiserFilter: string;
  advertiserOptions: Array<{ value: string; label: string }>;
  onAdvertiserChange: (value: string) => void;
  dateRangeFilter: '7d' | '30d' | '90d' | 'custom';
  onDateRangeChange: (value: '7d' | '30d' | '90d' | 'custom') => void;
  statusFilter: 'all' | 'active' | 'paused' | 'archived';
  onStatusChange: (value: 'all' | 'active' | 'paused' | 'archived') => void;
  search: string;
  onSearchChange: (value: string) => void;
  onCustomizeWidgets?: () => void;
  onResetFilters?: () => void;
}

const DATE_RANGE_OPTIONS = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: 'custom', label: 'Custom range' },
];

const STATUS_OPTIONS = [
  { value: 'all', label: 'All campaigns' },
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'archived', label: 'Archived' },
];

export function ReportingTopBar({
  secondaryAction,
  advertiserFilter,
  advertiserOptions,
  onAdvertiserChange,
  dateRangeFilter,
  onDateRangeChange,
  statusFilter,
  onStatusChange,
  search,
  onSearchChange,
  onCustomizeWidgets,
  onResetFilters,
}: ReportingTopBarProps) {
  const activeFilterCount = [
    advertiserFilter !== '',
    dateRangeFilter !== '30d',
    statusFilter !== 'all',
    search.trim() !== '',
  ].filter(Boolean).length;

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <FilterBar
        className="flex-1"
        pills={[
          {
            id: 'advertiser',
            label: 'Advertiser',
            value: advertiserFilter,
            options: [{ value: '', label: 'All advertisers' }, ...advertiserOptions],
            onChange: onAdvertiserChange,
          },
          {
            id: 'date-range',
            label: 'Date range',
            value: dateRangeFilter,
            options: DATE_RANGE_OPTIONS,
            onChange: (value) => onDateRangeChange(value as '7d' | '30d' | '90d' | 'custom'),
          },
          {
            id: 'status',
            label: 'Status',
            value: statusFilter,
            options: STATUS_OPTIONS,
            onChange: (value) => onStatusChange(value as 'all' | 'active' | 'paused' | 'archived'),
          },
        ]}
        search={{
          value: search,
          onChange: onSearchChange,
          placeholder: 'Search campaign, creative, region',
        }}
        activeFilterCount={activeFilterCount}
        onResetAll={onResetFilters}
      />

      <div className="flex items-center gap-3">
        {secondaryAction}
        {onCustomizeWidgets ? (
          <Button
            type="button"
            variant="secondary"
            leadingIcon={<Settings />}
            onClick={onCustomizeWidgets}
          >
            Customize widgets
          </Button>
        ) : null}
      </div>
    </div>
  );
}
