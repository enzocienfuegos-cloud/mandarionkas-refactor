import React from 'react';
import { Button, FilterBar, type DateRange } from '../../../system';
import { Settings } from '../../../system/icons';

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

function formatDateInputValue(value: Date | null) {
  return value ? value.toISOString().slice(0, 10) : '';
}

function parseDateInputValue(value: string) {
  if (!value) return null;
  const parsed = new Date(`${value}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

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

      {dateRangeFilter === 'custom' ? (
        <div className="flex flex-wrap items-end gap-3 rounded-[var(--dusk-radius-lg)] border border-[color:var(--dusk-border-subtle)] bg-[color:var(--dusk-surface-subtle)] px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[color:var(--dusk-text-primary)]">Custom reporting window</p>
            <p className="text-xs text-[color:var(--dusk-text-muted)]">Choose the exact dates used across workspace reporting widgets.</p>
          </div>
          <label className="flex min-w-[180px] flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--dusk-text-soft)]">From</span>
            <input
              type="date"
              max={formatDateInputValue(customDateRange.to ?? new Date()) || undefined}
              value={formatDateInputValue(customDateRange.from)}
              onChange={(event) => {
                onCustomDateRangeChange({
                  from: parseDateInputValue(event.target.value),
                  to: customDateRange.to,
                });
              }}
              className="h-12 rounded-lg border border-[color:var(--dusk-border-default)] bg-[color:var(--dusk-surface-1)] px-3 text-sm text-[color:var(--dusk-text-primary)] outline-none transition-[border-color,box-shadow] duration-base ease-standard hover:border-[color:var(--dusk-border-strong)]"
            />
          </label>
          <label className="flex min-w-[180px] flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--dusk-text-soft)]">To</span>
            <input
              type="date"
              min={formatDateInputValue(customDateRange.from) || undefined}
              max={formatDateInputValue(new Date())}
              value={formatDateInputValue(customDateRange.to)}
              onChange={(event) => {
                onCustomDateRangeChange({
                  from: customDateRange.from,
                  to: parseDateInputValue(event.target.value),
                });
              }}
              className="h-12 rounded-lg border border-[color:var(--dusk-border-default)] bg-[color:var(--dusk-surface-1)] px-3 text-sm text-[color:var(--dusk-text-primary)] outline-none transition-[border-color,box-shadow] duration-base ease-standard hover:border-[color:var(--dusk-border-strong)]"
            />
          </label>
        </div>
      ) : null}
    </div>
  );
}
