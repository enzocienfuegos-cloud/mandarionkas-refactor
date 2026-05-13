import React from 'react';
import { Button, DateRangePicker, FilterBar, type DateRange } from '../../../system';
import { RefreshCw, Settings } from '../../../system/icons';

export interface ReportingTopBarProps {
  secondaryAction?: React.ReactNode;
  advertiserFilter: string;
  advertiserOptions: Array<{ value: string; label: string }>;
  onAdvertiserChange: (value: string) => void;
  dateRangeFilter: '7d' | '30d' | '90d' | 'custom';
  onDateRangeChange: (value: '7d' | '30d' | '90d' | 'custom') => void;
  customDateRange: DateRange;
  onCustomDateRangeChange: (range: DateRange) => void;
  statusFilter: 'all' | 'active' | 'paused' | 'archived';
  onStatusChange: (value: 'all' | 'active' | 'paused' | 'archived') => void;
  spendView: 'without_margin' | 'with_margin';
  onSpendViewChange: (value: 'without_margin' | 'with_margin') => void;
  search: string;
  onSearchChange: (value: string) => void;
  onRefresh?: () => void;
  refreshing?: boolean;
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

const SPEND_VIEW_OPTIONS = [
  { value: 'without_margin', label: 'Without margin' },
  { value: 'with_margin', label: 'With margin' },
];

export function ReportingTopBar({
  secondaryAction,
  advertiserFilter,
  advertiserOptions,
  onAdvertiserChange,
  dateRangeFilter,
  onDateRangeChange,
  customDateRange,
  onCustomDateRangeChange,
  statusFilter,
  onStatusChange,
  spendView,
  onSpendViewChange,
  search,
  onSearchChange,
  onRefresh,
  refreshing = false,
  onCustomizeWidgets,
  onResetFilters,
}: ReportingTopBarProps) {
  const activeFilterCount = [
    advertiserFilter !== '',
    dateRangeFilter !== '30d',
    statusFilter !== 'all',
    spendView !== 'without_margin',
    search.trim() !== '',
  ].filter(Boolean).length;

  return (
    <div className="flex flex-col gap-3">
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
            {
              id: 'spend-view',
              label: 'Spend view',
              value: spendView,
              options: SPEND_VIEW_OPTIONS,
              onChange: (value) => onSpendViewChange(value as 'without_margin' | 'with_margin'),
            },
          ]}
          search={{
            value: search,
            onChange: onSearchChange,
            placeholder: 'Search campaign, creative, department, state',
          }}
          activeFilterCount={activeFilterCount}
          onResetAll={onResetFilters}
        />

        <div className="flex items-center gap-3">
          {onRefresh ? (
            <Button
              type="button"
              variant="secondary"
              leadingIcon={<RefreshCw />}
              loading={refreshing}
              onClick={onRefresh}
            >
              Refresh
            </Button>
          ) : null}
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

      {dateRangeFilter === 'custom' ? (
        <div className="flex flex-col gap-4 rounded-[var(--dusk-radius-xl)] border border-[color:var(--dusk-border-subtle)] bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.14),transparent_36%),color:var(--dusk-surface-subtle)] px-4 py-4 shadow-[var(--dusk-shadow-sm)] lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[color:var(--dusk-text-primary)]">Custom reporting window</p>
            <p className="text-xs leading-5 text-[color:var(--dusk-text-muted)]">
              Use the calendar range selector to drive every reporting widget with the same exact window.
            </p>
          </div>
          <div className="flex shrink-0">
            <DateRangePicker
              value={customDateRange}
              onChange={onCustomDateRangeChange}
              maxDate={new Date()}
              locale="en-US"
              weekStartsOn={1}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
