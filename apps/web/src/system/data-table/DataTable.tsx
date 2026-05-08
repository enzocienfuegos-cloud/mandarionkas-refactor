import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  Check,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  Columns3,
  MoreHorizontal,
} from '../icons';
import { DropdownMenu, type DropdownMenuEntry } from '../primitives/DropdownMenu';
import { IconButton } from '../primitives/Button';
import { Panel } from '../primitives/Panel';
import { Skeleton } from '../primitives/Skeleton';
import { cn } from '../cn';
import { getDensity, setDensity } from '../../shared/preferences';

export type SortDirection = 'asc' | 'desc';
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
  /** Pin to right side */
  pinnedRight?: boolean;
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
  /** Display when data exists but the filtered result is empty */
  filteredEmptyState?: React.ReactNode;
  /** Density mode. Default 'comfortable'. */
  density?: Density;
  /** Preference key for persisted density selection */
  densityKey?: string;
  /** Click handler for an entire row */
  onRowClick?: (row: T) => void;
  /** Enable row selection */
  selectable?: boolean;
  selectedKeys?: Set<string>;
  onSelectionChange?: (keys: Set<string>) => void;
  /** Bulk actions toolbar shown when rows are selected */
  renderBulkActions?: (selectedRows: T[]) => React.ReactNode;
  /** Compact row-level actions rendered in a trailing dropdown menu */
  rowActions?: (row: T) => DropdownMenuEntry[];
  /** Wrap in Panel (default true) */
  bordered?: boolean;
  /** Stick the header on scroll (default true) */
  stickyHeader?: boolean;
  /** Enable row virtualization. Recommended for >500 rows. */
  virtualize?: boolean;
  /** Estimated row height in px. */
  estimatedRowHeight?: number;
  /** Show column visibility menu. */
  showColumnVisibilityMenu?: boolean;
}

type SortRule = { id: string; direction: SortDirection };

const densityRowClass: Record<Density, string> = {
  compact: 'h-9 [&>td]:py-1.5',
  comfortable: 'h-12 [&>td]:py-3',
  spacious: 'h-16 [&>td]:py-4',
};

const densityHeights: Record<Density, number> = {
  compact: 36,
  comfortable: 48,
  spacious: 64,
};

const alignClass: Record<NonNullable<ColumnDef<unknown>['align']>, string> = {
  left: 'text-left',
  right: 'text-right',
  center: 'text-center',
};

function parseColumnWidth(width?: string): number {
  if (!width) return 120;
  const value = Number.parseInt(width, 10);
  return Number.isFinite(value) ? value : 120;
}

export function useDataTableDensity(
  key?: string,
  defaultValue: Density = 'comfortable',
): [Density, (next: Density) => void] {
  const [density, setLocalDensity] = useState<Density>(() => {
    if (!key) return defaultValue;
    return getDensity(key) ?? defaultValue;
  });

  const set = useCallback((next: Density) => {
    setLocalDensity(next);
    if (key) setDensity(key, next);
  }, [key]);

  return [density, set];
}

function ColumnVisibilityMenu<T>({
  columns,
  hiddenIds,
  setHiddenIds,
}: {
  columns: ColumnDef<T>[];
  hiddenIds: Set<string>;
  setHiddenIds: React.Dispatch<React.SetStateAction<Set<string>>>;
}) {
  return (
    <DropdownMenu
      trigger={(
        <IconButton
          icon={<Columns3 />}
          aria-label="Show or hide columns"
          size="sm"
          variant="ghost"
        />
      )}
      items={columns.map((column) => ({
        id: column.id,
        label: typeof column.header === 'string' ? column.header : column.id,
        icon: hiddenIds.has(column.id) ? undefined : <Check className="h-4 w-4" />,
        onSelect: () => {
          setHiddenIds((current) => {
            const next = new Set(current);
            if (next.has(column.id)) next.delete(column.id);
            else next.add(column.id);
            return next;
          });
        },
      }))}
    />
  );
}

/**
 * Headless data table with sort, density, selection, pinned columns,
 * virtualization and column visibility controls.
 */
export function DataTable<T>({
  columns: rawColumns,
  data,
  rowKey,
  loading = false,
  emptyState,
  filteredEmptyState,
  density,
  densityKey,
  onRowClick,
  selectable = false,
  selectedKeys,
  onSelectionChange,
  renderBulkActions,
  rowActions,
  bordered = true,
  stickyHeader = true,
  virtualize = false,
  estimatedRowHeight,
  showColumnVisibilityMenu = true,
}: DataTableProps<T>) {
  const [sort, setSort] = useState<SortRule[]>([]);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(
    () => new Set(rawColumns.filter((column) => column.defaultHidden).map((column) => column.id)),
  );
  const [storedDensity, setStoredDensity] = useDataTableDensity(densityKey, density ?? 'comfortable');
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [isStickied, setIsStickied] = useState(false);
  const [hasHorizontalScroll, setHasHorizontalScroll] = useState(false);

  useEffect(() => {
    if (!density) return;
    setStoredDensity(density);
  }, [density, setStoredDensity]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      ([entry]) => setIsStickied(!entry.isIntersecting),
      { threshold: 0 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const node = scrollContainerRef.current;
    if (!node) return;

    const update = () => {
      setHasHorizontalScroll(node.scrollLeft > 0);
    };

    update();
    node.addEventListener('scroll', update, { passive: true });
    return () => node.removeEventListener('scroll', update);
  }, []);

  const effectiveDensity = useMemo<Density>(() => {
    if (
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(max-width: 767px)').matches
    ) {
      return 'comfortable';
    }
    return storedDensity;
  }, [storedDensity]);

  const visibleColumns = useMemo(
    () => rawColumns.filter((column) => !hiddenIds.has(column.id)),
    [rawColumns, hiddenIds],
  );
  const pinnedColumns = useMemo(
    () => visibleColumns.filter((column) => column.pinned),
    [visibleColumns],
  );
  const pinnedRightColumns = useMemo(
    () => visibleColumns.filter((column) => column.pinnedRight),
    [visibleColumns],
  );
  const orderedColumns = useMemo(
    () => [
      ...pinnedColumns,
      ...visibleColumns.filter((column) => !column.pinned && !column.pinnedRight),
      ...pinnedRightColumns,
    ],
    [pinnedColumns, pinnedRightColumns, visibleColumns],
  );

  const pinnedOffsets = useMemo(() => {
    let total = 0;
    const offsets = new Map<string, number>();
    pinnedColumns.forEach((column) => {
      offsets.set(column.id, total);
      total += parseColumnWidth(column.width);
    });
    return offsets;
  }, [pinnedColumns]);

  const pinnedRightOffsets = useMemo(() => {
    let total = rowActions ? 56 : 0;
    const offsets = new Map<string, number>();
    [...pinnedRightColumns].reverse().forEach((column) => {
      offsets.set(column.id, total);
      total += parseColumnWidth(column.width);
    });
    return offsets;
  }, [pinnedRightColumns, rowActions]);

  const sortedData = useMemo(() => {
    if (sort.length === 0) return data;

    return [...data].sort((leftRow, rightRow) => {
      for (const rule of sort) {
        const column = rawColumns.find((entry) => entry.id === rule.id);
        if (!column?.sortAccessor) continue;
        const leftValue = column.sortAccessor(leftRow);
        const rightValue = column.sortAccessor(rightRow);
        if (leftValue == null && rightValue == null) continue;
        if (leftValue == null) return 1;
        if (rightValue == null) return -1;
        if (leftValue < rightValue) return rule.direction === 'asc' ? -1 : 1;
        if (leftValue > rightValue) return rule.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }, [data, rawColumns, sort]);

  const handleSort = (column: ColumnDef<T>, event: React.MouseEvent) => {
    if (!column.sortAccessor) return;

    setSort((current) => {
      const existing = current.find((entry) => entry.id === column.id);
      if (event.shiftKey) {
        if (!existing) return [...current, { id: column.id, direction: 'asc' }];
        if (existing.direction === 'asc') {
          return current.map((entry) => entry.id === column.id ? { ...entry, direction: 'desc' } : entry);
        }
        return current.filter((entry) => entry.id !== column.id);
      }

      if (!existing) return [{ id: column.id, direction: 'asc' }];
      if (existing.direction === 'asc') return [{ id: column.id, direction: 'desc' }];
      return [];
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
    [rowKey, selectedKeys, sortedData],
  );

  const rowHeight = estimatedRowHeight ?? densityHeights[effectiveDensity];
  const rowVirtualizer = useVirtualizer({
    count: sortedData.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => rowHeight,
    initialRect: virtualize ? { width: 0, height: rowHeight * 8 } : undefined,
    overscan: 8,
    enabled: virtualize,
  });
  const virtualItems = virtualize ? rowVirtualizer.getVirtualItems() : [];
  const initialVirtualRows = useMemo(
    () => sortedData.slice(0, Math.min(sortedData.length, 16)),
    [sortedData],
  );
  const totalSize = virtualize ? rowVirtualizer.getTotalSize() : 0;
  const visibleRows = virtualize
    ? (virtualItems.length > 0
      ? virtualItems.map((item) => ({
          index: item.index,
          key: item.key,
          row: sortedData[item.index],
        }))
      : initialVirtualRows.map((row, index) => ({
          index,
          key: rowKey(row),
          row,
        })))
    : sortedData.map((row, index) => ({
        index,
        key: rowKey(row),
        row,
      }));
  const topSpacer = virtualize && virtualItems.length > 0 ? virtualItems[0].start : 0;
  const bottomSpacer = virtualize && virtualItems.length > 0
    ? totalSize - virtualItems[virtualItems.length - 1].end
    : 0;

  const renderCellClass = (column: ColumnDef<T>) => cn(
    'px-4 border-b border-[color:var(--dusk-border-subtle)]',
    'text-[color:var(--dusk-text-secondary)]',
    alignClass[column.align ?? 'left'],
    column.numeric && 'tabular',
    (column.pinned || column.pinnedRight) && 'sticky bg-surface-1 z-[1]',
  );

  const renderHeaderCellClass = (column: ColumnDef<T>, sortedEntry?: SortRule) => cn(
    'border-b border-[color:var(--dusk-border-default)] px-4 py-3',
    'text-[11px] font-semibold uppercase tracking-kicker text-[color:var(--dusk-text-soft)]',
    alignClass[column.align ?? 'left'],
    column.sortAccessor && 'cursor-pointer select-none hover:text-[color:var(--dusk-text-primary)]',
    (column.pinned || column.pinnedRight) && 'sticky top-0 bg-[color:var(--dusk-surface-muted)] z-[2]',
  );

  const renderRow = (row: T) => {
    const key = rowKey(row);
    const isSelected = selectedKeys?.has(key);

    return (
      <tr
        key={key}
        className={cn(
          densityRowClass[effectiveDensity],
          'transition-colors',
          onRowClick && 'cursor-pointer',
          isSelected ? 'bg-surface-active' : 'hover:bg-[color:var(--dusk-surface-hover)]',
        )}
        onClick={onRowClick ? () => onRowClick(row) : undefined}
      >
        {selectable && (
          <td
            className="sticky left-0 z-[1] border-b border-[color:var(--dusk-border-subtle)] bg-surface-1 px-3"
            onClick={(event) => event.stopPropagation()}
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
        {orderedColumns.map((column) => {
          const pinned = column.pinned;
          const pinnedRight = column.pinnedRight;
          const isLastPinned = pinned && pinnedColumns[pinnedColumns.length - 1]?.id === column.id;
          const isFirstPinnedRight = pinnedRight && pinnedRightColumns[0]?.id === column.id;
          return (
            <td
              key={column.id}
              className={renderCellClass(column)}
              style={pinned ? {
                left: `${pinnedOffsets.get(column.id) ?? 0}px`,
                width: column.width,
                boxShadow: isLastPinned && hasHorizontalScroll ? '8px 0 16px rgba(23, 20, 31, 0.06)' : undefined,
              } : pinnedRight ? {
                right: `${pinnedRightOffsets.get(column.id) ?? 0}px`,
                width: column.width,
                boxShadow: isFirstPinnedRight ? '-8px 0 16px rgba(23, 20, 31, 0.06)' : undefined,
              } : { width: column.width }}
            >
              {column.cell(row)}
            </td>
          );
        })}
        {rowActions && (
          <td
            className="sticky right-0 z-[1] border-b border-[color:var(--dusk-border-subtle)] bg-surface-1 px-3 text-right"
            onClick={(event) => event.stopPropagation()}
          >
            <DropdownMenu
              trigger={(
                <IconButton
                  icon={<MoreHorizontal />}
                  aria-label={`Row actions for ${key}`}
                  size="sm"
                  variant="ghost"
                />
              )}
              items={rowActions(row)}
            />
          </td>
        )}
      </tr>
    );
  };

  const tableEl = (
    <div
      ref={scrollContainerRef}
      className={cn(
        'relative overflow-auto dusk-scrollbar',
        bordered && 'rounded-2xl',
        virtualize && 'h-full min-h-0',
      )}
    >
      <div ref={sentinelRef} aria-hidden style={{ height: 1 }} />

      {showColumnVisibilityMenu && rawColumns.length > 0 && (
        <div className="sticky right-0 top-0 z-[3] flex justify-end bg-[color:var(--dusk-surface-muted)] px-3 py-2">
          <ColumnVisibilityMenu columns={rawColumns} hiddenIds={hiddenIds} setHiddenIds={setHiddenIds} />
        </div>
      )}

      <table className="dusk-table w-full text-sm border-separate border-spacing-0">
        <thead className={cn(stickyHeader && 'sticky top-0 z-10', isStickied && 'shadow-2', 'bg-[color:var(--dusk-surface-muted)]')}>
          <tr>
            {selectable && (
              <th
                scope="col"
                className="sticky left-0 z-[2] w-10 border-b border-[color:var(--dusk-border-default)] bg-[color:var(--dusk-surface-muted)] px-3"
              >
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(element) => {
                    if (element) element.indeterminate = !!selectedKeys && selectedKeys.size > 0 && !allSelected;
                  }}
                  onChange={toggleAll}
                  aria-label="Select all rows"
                  className="h-4 w-4 cursor-pointer accent-brand-500"
                />
              </th>
            )}
            {orderedColumns.map((column) => {
              const sortedEntry = sort.find((entry) => entry.id === column.id);
              const sortOrder = sort.findIndex((entry) => entry.id === column.id);
              const pinned = column.pinned;
              const pinnedRight = column.pinnedRight;
              const isLastPinned = pinned && pinnedColumns[pinnedColumns.length - 1]?.id === column.id;
              const isFirstPinnedRight = pinnedRight && pinnedRightColumns[0]?.id === column.id;
              return (
                <th
                  key={column.id}
                  scope="col"
                  style={pinned ? {
                    width: column.width,
                    left: `${pinnedOffsets.get(column.id) ?? 0}px`,
                    boxShadow: isLastPinned && hasHorizontalScroll ? '8px 0 16px rgba(23, 20, 31, 0.06)' : undefined,
                  } : pinnedRight ? {
                    width: column.width,
                    right: `${pinnedRightOffsets.get(column.id) ?? 0}px`,
                    boxShadow: isFirstPinnedRight ? '-8px 0 16px rgba(23, 20, 31, 0.06)' : undefined,
                  } : { width: column.width }}
                  className={renderHeaderCellClass(column, sortedEntry)}
                  onClick={(event) => column.sortAccessor && handleSort(column, event)}
                  aria-sort={
                    sortedEntry
                      ? sortedEntry.direction === 'asc' ? 'ascending' : 'descending'
                      : undefined
                  }
                >
                  <span className="inline-flex items-center gap-1.5">
                    {column.header}
                    {column.sortAccessor && (
                      <SortIcon direction={sortedEntry?.direction ?? null} order={sort.length > 1 && sortOrder >= 0 ? sortOrder + 1 : null} />
                    )}
                  </span>
                </th>
              );
            })}
            {rowActions && (
              <th
                scope="col"
                className="sticky right-0 z-[2] border-b border-[color:var(--dusk-border-default)] bg-[color:var(--dusk-surface-muted)] px-3 py-3 text-right text-[11px] font-semibold uppercase tracking-kicker text-[color:var(--dusk-text-soft)]"
              >
                <span className="sr-only">Actions</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            Array.from({ length: 5 }).map((_, index) => (
              <tr key={`skel-${index}`} className={densityRowClass[effectiveDensity]}>
                {selectable && (
                  <td className="px-3">
                    <Skeleton className="h-4 w-4" />
                  </td>
                )}
                {orderedColumns.map((column) => (
                  <td
                    key={column.id}
                    className={cn(
                      'px-4 border-b border-[color:var(--dusk-border-subtle)]',
                      alignClass[column.align ?? 'left'],
                    )}
                  >
                    <Skeleton className="h-4 w-24" />
                  </td>
                ))}
                {rowActions && (
                  <td className="px-3 border-b border-[color:var(--dusk-border-subtle)] text-right">
                    <Skeleton className="ml-auto h-8 w-8 rounded-md" />
                  </td>
                )}
              </tr>
            ))
          ) : sortedData.length === 0 ? (
            <tr>
              <td
                colSpan={orderedColumns.length + (selectable ? 1 : 0) + (rowActions ? 1 : 0)}
                className="px-4 py-12 text-center"
              >
                {data.length > 0 ? filteredEmptyState ?? emptyState ?? (
                  <p className="text-sm text-[color:var(--dusk-text-muted)]">No matching results</p>
                ) : emptyState ?? (
                  <p className="text-sm text-[color:var(--dusk-text-muted)]">No results</p>
                )}
              </td>
            </tr>
          ) : (
            <>
              {virtualize && topSpacer > 0 ? (
                <tr aria-hidden>
                  <td
                    colSpan={orderedColumns.length + (selectable ? 1 : 0) + (rowActions ? 1 : 0)}
                    style={{ height: `${topSpacer}px`, padding: 0, border: 0 }}
                  />
                </tr>
              ) : null}
              {visibleRows.map(({ key, row }) => (
                <React.Fragment key={key}>
                  {renderRow(row)}
                </React.Fragment>
              ))}
              {virtualize && bottomSpacer > 0 ? (
                <tr aria-hidden>
                  <td
                    colSpan={orderedColumns.length + (selectable ? 1 : 0) + (rowActions ? 1 : 0)}
                    style={{ height: `${bottomSpacer}px`, padding: 0, border: 0 }}
                  />
                </tr>
              ) : null}
            </>
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className={cn('relative', virtualize && 'h-full min-h-0')}>
      {selectable && selectedRows.length > 0 && renderBulkActions && (
        <div className="sticky top-0 z-sticky -mx-px -mt-px flex items-center justify-between gap-3 rounded-t-2xl border-b border-brand-500/30 bg-[color:var(--dusk-surface-active)] px-4 py-2 animate-[duskFadeIn_180ms_ease-out]">
          <span className="text-sm font-medium text-[color:var(--dusk-text-primary)]">
            {selectedRows.length} selected
          </span>
          <div className="flex items-center gap-2">
            {renderBulkActions(selectedRows)}
          </div>
        </div>
      )}

      {bordered ? (
        <Panel padding="none" className={cn('overflow-hidden', virtualize && 'h-full min-h-0')}>
          {tableEl}
        </Panel>
      ) : (
        tableEl
      )}
    </div>
  );
}

function SortIcon({ direction, order }: { direction: SortDirection | null; order: number | null }) {
  if (direction === 'asc') {
    return (
      <span className="inline-flex items-center gap-1">
        <ChevronUp className="h-3 w-3" />
        {order ? <span className="text-[10px]">{order}</span> : null}
      </span>
    );
  }
  if (direction === 'desc') {
    return (
      <span className="inline-flex items-center gap-1">
        <ChevronDown className="h-3 w-3" />
        {order ? <span className="text-[10px]">{order}</span> : null}
      </span>
    );
  }
  return <ChevronsUpDown className="h-3 w-3 opacity-40" />;
}
