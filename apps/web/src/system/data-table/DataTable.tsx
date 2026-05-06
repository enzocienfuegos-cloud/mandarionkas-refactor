import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, ChevronsUpDown } from '../icons';
import { Panel } from '../primitives/Panel';
import { Skeleton } from '../primitives/Skeleton';
import { cn } from '../cn';

export type SortDirection = 'asc' | 'desc' | null;
export type Density = 'compact' | 'comfortable' | 'spacious';

export interface ColumnDef<T> {
  /** Unique column id */
  id: string;
  /** Header label */
  header: React.ReactNode;
  /** How to render a cell. Receives the row. */
  cell: (row: T) => React.ReactNode;
  /** How to extract a sortable value. If omitted, column is not sortable. */
  sortAccessor?: (row: T) => string | number | null | undefined;
  /** Width hint, e.g. '180px', '15%' */
  width?: string;
  /** Right-align (use for numeric columns) */
  align?: 'left' | 'right' | 'center';
  /** Mark column to use tabular-nums */
  numeric?: boolean;
  /** Pin to left side */
  pinned?: boolean;
  /** Hide by default */
  defaultHidden?: boolean;
}

export interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  /** How to extract a stable key from a row */
  rowKey: (row: T) => string;
  loading?: boolean;
  /** Display when data is empty (and not loading) */
  emptyState?: React.ReactNode;
  /** Density mode. Default 'comfortable'. */
  density?: Density;
  /** Click handler for an entire row */
  onRowClick?: (row: T) => void;
  /** Enable row selection */
  selectable?: boolean;
  selectedKeys?: Set<string>;
  onSelectionChange?: (keys: Set<string>) => void;
  /** Bulk actions toolbar shown when rows are selected */
  renderBulkActions?: (selectedRows: T[]) => React.ReactNode;
  /** Wrap in Panel (default true) */
  bordered?: boolean;
  /** Stick the header on scroll (default true) */
  stickyHeader?: boolean;
}

const densityRowClass: Record<Density, string> = {
  compact:     'h-9 [&>td]:py-1.5',
  comfortable: 'h-12 [&>td]:py-3',
  spacious:    'h-16 [&>td]:py-4',
};

const alignClass: Record<NonNullable<ColumnDef<unknown>['align']>, string> = {
  left:   'text-left',
  right:  'text-right',
  center: 'text-center',
};

/**
 * Headless data table with sort, density, selection and bulk actions.
 * Replaces every ad-hoc <table> in the app.
 */
export function DataTable<T>({
  columns: rawColumns,
  data,
  rowKey,
  loading = false,
  emptyState,
  density = 'comfortable',
  onRowClick,
  selectable = false,
  selectedKeys,
  onSelectionChange,
  renderBulkActions,
  bordered = true,
  stickyHeader = true,
}: DataTableProps<T>) {
  const [sort, setSort]               = useState<{ id: string; direction: SortDirection } | null>(null);
  const [hiddenIds, setHiddenIds]     = useState<Set<string>>(
    () => new Set(rawColumns.filter((c) => c.defaultHidden).map((c) => c.id)),
  );

  const visibleColumns = useMemo(
    () => rawColumns.filter((c) => !hiddenIds.has(c.id)),
    [rawColumns, hiddenIds],
  );

  const sortedData = useMemo(() => {
    if (!sort || !sort.direction) return data;
    const col = rawColumns.find((c) => c.id === sort.id);
    if (!col?.sortAccessor) return data;
    const dir = sort.direction === 'asc' ? 1 : -1;
    return [...data].sort((a, b) => {
      const av = col.sortAccessor!(a);
      const bv = col.sortAccessor!(b);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
  }, [data, sort, rawColumns]);

  const handleSort = (column: ColumnDef<T>) => {
    if (!column.sortAccessor) return;
    setSort((current) => {
      if (current?.id !== column.id) return { id: column.id, direction: 'asc' };
      if (current.direction === 'asc') return { id: column.id, direction: 'desc' };
      return null;
    });
  };

  const allKeys = useMemo(() => new Set(sortedData.map(rowKey)), [sortedData, rowKey]);
  const allSelected = selectable && selectedKeys && selectedKeys.size > 0 && selectedKeys.size === allKeys.size;

  const toggleAll = () => {
    if (!onSelectionChange) return;
    if (allSelected) onSelectionChange(new Set());
    else onSelectionChange(new Set(allKeys));
  };

  const toggleOne = (key: string) => {
    if (!onSelectionChange || !selectedKeys) return;
    const next = new Set(selectedKeys);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onSelectionChange(next);
  };

  const selectedRows = useMemo(
    () => (selectedKeys ? sortedData.filter((row) => selectedKeys.has(rowKey(row))) : []),
    [selectedKeys, sortedData, rowKey],
  );

  const tableEl = (
    <div className={cn('relative overflow-auto dusk-scrollbar', bordered && 'rounded-2xl')}>
      <table className="dusk-table w-full text-sm border-separate border-spacing-0">
        <thead className={cn(stickyHeader && 'sticky top-0 z-10', 'bg-[color:var(--dusk-surface-muted)]')}>
          <tr>
            {selectable && (
              <th
                scope="col"
                className="border-b border-[color:var(--dusk-border-default)] px-3 w-10"
              >
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = !!selectedKeys && selectedKeys.size > 0 && !allSelected;
                  }}
                  onChange={toggleAll}
                  aria-label="Select all rows"
                  className="h-4 w-4 cursor-pointer accent-brand-500"
                />
              </th>
            )}
            {visibleColumns.map((col) => {
              const isSorted = sort?.id === col.id && sort.direction;
              return (
                <th
                  key={col.id}
                  scope="col"
                  style={{ width: col.width }}
                  className={cn(
                    'border-b border-[color:var(--dusk-border-default)] px-4 py-3',
                    'text-[11px] font-semibold uppercase tracking-kicker text-[color:var(--dusk-text-soft)]',
                    alignClass[col.align ?? 'left'],
                    col.sortAccessor && 'cursor-pointer select-none hover:text-[color:var(--dusk-text-primary)]',
                  )}
                  onClick={() => col.sortAccessor && handleSort(col)}
                  aria-sort={
                    isSorted ? (sort!.direction === 'asc' ? 'ascending' : 'descending') : undefined
                  }
                >
                  <span className="inline-flex items-center gap-1.5">
                    {col.header}
                    {col.sortAccessor && (
                      <SortIcon direction={isSorted ? sort!.direction : null} />
                    )}
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <tr key={`skel-${i}`} className={densityRowClass[density]}>
                {selectable && (
                  <td className="px-3">
                    <Skeleton className="h-4 w-4" />
                  </td>
                )}
                {visibleColumns.map((col) => (
                  <td
                    key={col.id}
                    className={cn(
                      'px-4 border-b border-[color:var(--dusk-border-subtle)]',
                      alignClass[col.align ?? 'left'],
                    )}
                  >
                    <Skeleton className="h-4 w-24" />
                  </td>
                ))}
              </tr>
            ))
          ) : sortedData.length === 0 ? (
            <tr>
              <td
                colSpan={visibleColumns.length + (selectable ? 1 : 0)}
                className="px-4 py-12 text-center"
              >
                {emptyState ?? (
                  <p className="text-sm text-[color:var(--dusk-text-muted)]">No results</p>
                )}
              </td>
            </tr>
          ) : (
            sortedData.map((row) => {
              const key = rowKey(row);
              const isSelected = selectedKeys?.has(key);
              return (
                <tr
                  key={key}
                  className={cn(
                    densityRowClass[density],
                    'transition-colors',
                    onRowClick && 'cursor-pointer',
                    isSelected
                      ? 'bg-surface-active'
                      : 'hover:bg-[color:var(--dusk-surface-hover)]',
                  )}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                >
                  {selectable && (
                    <td
                      className="px-3 border-b border-[color:var(--dusk-border-subtle)]"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={!!isSelected}
                        onChange={() => toggleOne(key)}
                        aria-label="Select row"
                        className="h-4 w-4 cursor-pointer accent-brand-500"
                      />
                    </td>
                  )}
                  {visibleColumns.map((col) => (
                    <td
                      key={col.id}
                      className={cn(
                        'px-4 border-b border-[color:var(--dusk-border-subtle)]',
                        'text-[color:var(--dusk-text-secondary)]',
                        alignClass[col.align ?? 'left'],
                        col.numeric && 'tabular',
                      )}
                    >
                      {col.cell(row)}
                    </td>
                  ))}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="relative">
      {selectable && selectedRows.length > 0 && renderBulkActions && (
        <div
          className={cn(
            'mb-3 flex items-center justify-between gap-3 px-4 py-2 rounded-lg',
            'bg-surface-active border border-brand-500/30',
            'animate-[duskFadeIn_180ms_ease-out]',
          )}
        >
          <span className="text-sm font-medium text-[color:var(--dusk-text-primary)]">
            {selectedRows.length} selected
          </span>
          <div className="flex items-center gap-2">
            {renderBulkActions(selectedRows)}
          </div>
        </div>
      )}

      {bordered ? (
        <Panel padding="none" className="overflow-hidden">
          {tableEl}
        </Panel>
      ) : (
        tableEl
      )}
    </div>
  );
}

function SortIcon({ direction }: { direction: SortDirection }) {
  if (direction === 'asc')  return <ChevronUp className="h-3 w-3" />;
  if (direction === 'desc') return <ChevronDown className="h-3 w-3" />;
  return <ChevronsUpDown className="h-3 w-3 opacity-40" />;
}
