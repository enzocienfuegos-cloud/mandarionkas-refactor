import React from 'react';
import { Search, Filter as FilterIcon, X } from '../../system/icons';
import { Panel, Input, Select, Button } from '../../system';
import type { CreativeFilters as Filters } from './types';
import { FORMAT_OPTIONS, STATUS_OPTIONS } from './types';

export interface CreativeFiltersProps {
  filters: Filters;
  onChange: (filters: Filters) => void;
  totalCount: number;
  filteredCount: number;
}

/**
 * Filters bar for the Creative Library.
 * Stateless — all state lives in the parent.
 */
export function CreativeFiltersBar({
  filters,
  onChange,
  totalCount,
  filteredCount,
}: CreativeFiltersProps) {
  const hasFilters =
    filters.search !== '' ||
    filters.format !== 'all' ||
    filters.status !== 'all' ||
    Boolean(filters.uploadedAfter);

  const reset = () =>
    onChange({ search: '', format: 'all', status: 'all', uploadedAfter: undefined });

  return (
    <Panel padding="md">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          inputSize="md"
          leadingIcon={<Search />}
          placeholder="Search creatives…"
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
          className="max-w-sm"
          fullWidth={false}
        />

        <Select
          selectSize="md"
          value={filters.format}
          onChange={(e) => onChange({ ...filters, format: e.target.value as Filters['format'] })}
          options={FORMAT_OPTIONS}
          fullWidth={false}
          className="min-w-[140px]"
        />

        <Select
          selectSize="md"
          value={filters.status}
          onChange={(e) => onChange({ ...filters, status: e.target.value as Filters['status'] })}
          options={STATUS_OPTIONS}
          fullWidth={false}
          className="min-w-[140px]"
        />

        <Button variant="ghost" leadingIcon={<FilterIcon />}>More filters</Button>

        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs text-[color:var(--dusk-text-muted)]">
            <span className="dusk-mono tabular text-[color:var(--dusk-text-secondary)]">{filteredCount}</span>
            {filteredCount !== totalCount && (
              <> of <span className="dusk-mono tabular">{totalCount}</span></>
            )}
          </span>
          {hasFilters && (
            <Button size="sm" variant="ghost" leadingIcon={<X />} onClick={reset}>
              Clear
            </Button>
          )}
        </div>
      </div>
    </Panel>
  );
}
