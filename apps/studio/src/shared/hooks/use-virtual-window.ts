import { useEffect, useMemo, useState, type RefObject } from 'react';

export type VirtualLayoutOptions = {
  viewportSize: number;
  scrollOffset: number;
  estimateSize: number;
  overscan?: number;
  lanes?: number;
  gap?: number;
  enabled?: boolean;
};

export type VirtualLayout = {
  rowCount: number;
  startRow: number;
  endRow: number;
  totalSize: number;
  paddingStart: number;
  paddingEnd: number;
};

export type VirtualWindowOptions = Omit<VirtualLayoutOptions, 'viewportSize' | 'scrollOffset'> & {
  scrollRef: RefObject<HTMLElement | null>;
  contentOffset?: number;
};

export type VirtualWindowItem<T> = {
  item: T;
  index: number;
  lane: number;
  row: number;
};

export type VirtualWindowRow<T> = {
  index: number;
  start: number;
  size: number;
  items: VirtualWindowItem<T>[];
};

export type VirtualWindowResult<T> = VirtualLayout & {
  rows: VirtualWindowRow<T>[];
  visibleItems: VirtualWindowItem<T>[];
};

type ScrollMetrics = {
  viewportSize: number;
  scrollOffset: number;
};

function getRowStride(estimateSize: number, gap: number): number {
  return Math.max(1, estimateSize) + Math.max(0, gap);
}

export function calculateVirtualWindow(
  itemCount: number,
  {
    viewportSize,
    scrollOffset,
    estimateSize,
    overscan = 4,
    lanes = 1,
    gap = 0,
    enabled = true,
  }: VirtualLayoutOptions,
): VirtualLayout {
  const safeLanes = Math.max(1, lanes);
  const rowCount = Math.ceil(itemCount / safeLanes);
  const rowStride = getRowStride(estimateSize, gap);
  const totalSize = rowCount > 0 ? rowCount * Math.max(1, estimateSize) + Math.max(0, rowCount - 1) * Math.max(0, gap) : 0;

  if (!enabled || rowCount === 0 || viewportSize <= 0) {
    return {
      rowCount,
      startRow: 0,
      endRow: rowCount,
      totalSize,
      paddingStart: 0,
      paddingEnd: 0,
    };
  }

  const viewportRows = Math.max(1, Math.ceil(viewportSize / rowStride));
  const startRow = Math.max(0, Math.floor(Math.max(0, scrollOffset) / rowStride) - overscan);
  const endRow = Math.min(rowCount, startRow + viewportRows + overscan * 2);
  const renderedRowCount = Math.max(0, endRow - startRow);
  const paddingStart = startRow * rowStride;
  const renderedSize = renderedRowCount > 0 ? renderedRowCount * Math.max(1, estimateSize) + Math.max(0, renderedRowCount - 1) * Math.max(0, gap) : 0;
  const paddingEnd = Math.max(0, totalSize - paddingStart - renderedSize);

  return {
    rowCount,
    startRow,
    endRow,
    totalSize,
    paddingStart,
    paddingEnd,
  };
}

export function useVirtualWindow<T>(
  items: T[],
  {
    scrollRef,
    contentOffset = 0,
    estimateSize,
    overscan = 4,
    lanes = 1,
    gap = 0,
    enabled = true,
  }: VirtualWindowOptions,
): VirtualWindowResult<T> {
  const [metrics, setMetrics] = useState<ScrollMetrics>({ viewportSize: 0, scrollOffset: 0 });

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return undefined;

    const update = (): void => {
      setMetrics({
        viewportSize: Math.max(0, element.clientHeight - contentOffset),
        scrollOffset: Math.max(0, element.scrollTop - contentOffset),
      });
    };

    update();
    element.addEventListener('scroll', update, { passive: true });

    const ResizeObserverCtor = typeof window !== 'undefined' ? window.ResizeObserver : undefined;
    const resizeObserver = ResizeObserverCtor ? new ResizeObserverCtor(update) : null;
    resizeObserver?.observe(element);

    return () => {
      element.removeEventListener('scroll', update);
      resizeObserver?.disconnect();
    };
  }, [contentOffset, scrollRef]);

  const layout = useMemo(
    () =>
      calculateVirtualWindow(items.length, {
        viewportSize: metrics.viewportSize,
        scrollOffset: metrics.scrollOffset,
        estimateSize,
        overscan,
        lanes,
        gap,
        enabled,
      }),
    [enabled, estimateSize, gap, items.length, lanes, metrics.scrollOffset, metrics.viewportSize, overscan],
  );

  const rows = useMemo<VirtualWindowRow<T>[]>(() => {
    const safeLanes = Math.max(1, lanes);
    const safeGap = Math.max(0, gap);
    const start = layout.startRow;
    const end = layout.endRow;

    return Array.from({ length: Math.max(0, end - start) }, (_, offset) => {
      const rowIndex = start + offset;
      const rowStart = rowIndex * getRowStride(estimateSize, safeGap);
      const rowItems = items.slice(rowIndex * safeLanes, rowIndex * safeLanes + safeLanes).map((item, lane) => ({
        item,
        index: rowIndex * safeLanes + lane,
        lane,
        row: rowIndex,
      }));
      return {
        index: rowIndex,
        start: rowStart,
        size: estimateSize,
        items: rowItems,
      };
    });
  }, [estimateSize, gap, items, lanes, layout.endRow, layout.startRow]);

  return {
    ...layout,
    rows,
    visibleItems: rows.flatMap((row) => row.items),
  };
}

export function useVirtualWindowPadding(
  ref: RefObject<HTMLElement | null>,
  paddingStart: number,
  paddingEnd: number,
  prefix = '--virtual-window',
): void {
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.style.setProperty(`${prefix}-padding-start`, `${paddingStart}px`);
    element.style.setProperty(`${prefix}-padding-end`, `${paddingEnd}px`);
  }, [paddingEnd, paddingStart, prefix, ref]);
}
