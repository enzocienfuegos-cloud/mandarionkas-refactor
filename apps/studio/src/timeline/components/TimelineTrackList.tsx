import type { RefObject } from 'react';
import { useRef } from 'react';
import { useVirtualWindow, useVirtualWindowPadding } from '../../shared/hooks/use-virtual-window';
import { TimelineEmptyState } from './TimelineEmptyState';
import { TimelineTrackRow } from './TimelineTrackRow';
import type { TimelineDragState, TimelineDisplayRow } from '../types';

export function TimelineTrackList({
  scrollContainerRef,
  displayedWidgets,
  selectedIds,
  playheadMs,
  rowMsToPx,
  trackWidth,
  snapGuideMs,
  sceneDurationMs,
  collapsedGroupIds,
  selectedOnly,
  onSelectWidget,
  onToggleWidgetHidden,
  onToggleWidgetLocked,
  onUpdateWidgetName,
  onReorderWidget,
  onToggleGroupCollapse,
  onDragStart,
  onScrubStart,
}: {
  scrollContainerRef: RefObject<HTMLDivElement>;
  displayedWidgets: TimelineDisplayRow[];
  selectedIds: string[];
  playheadMs: number;
  rowMsToPx: number;
  trackWidth: number;
  snapGuideMs?: number;
  sceneDurationMs: number;
  collapsedGroupIds: string[];
  selectedOnly: boolean;
  onSelectWidget: (widgetId: string, additive?: boolean) => void;
  onToggleWidgetHidden: (widgetId: string) => void;
  onToggleWidgetLocked: (widgetId: string) => void;
  onUpdateWidgetName: (widgetId: string, nextName: string) => void;
  onReorderWidget: (widgetId: string, direction: 'forward' | 'backward') => void;
  onToggleGroupCollapse: (widgetId: string) => void;
  onDragStart: (drag: Exclude<TimelineDragState, null>) => void;
  onScrubStart: (clientX: number, startMs: number) => void;
}): JSX.Element {
  const rowsRef = useRef<HTMLDivElement>(null);
  const virtualRows = useVirtualWindow(displayedWidgets, {
    scrollRef: scrollContainerRef,
    contentOffset: 40,
    estimateSize: 38,
    gap: 2,
    overscan: 10,
  });
  useVirtualWindowPadding(rowsRef, 6 + virtualRows.paddingStart, virtualRows.paddingEnd);

  if (!displayedWidgets.length) {
    return (
      <div ref={rowsRef} className="timeline-rows timeline-rows--empty virtual-window-pad" data-collapsed-groups={collapsedGroupIds.length}>
        <TimelineEmptyState selectedOnly={selectedOnly} />
      </div>
    );
  }

  return (
    <div ref={rowsRef} className="timeline-rows virtual-window-pad" data-collapsed-groups={collapsedGroupIds.length}>
      {virtualRows.visibleItems.map(({ item: row, index }) => {
        const { widget, timing } = row;
        const selected = selectedIds.includes(widget.id);
        const isActive = playheadMs >= timing.startMs && playheadMs <= timing.endMs;
        return (
          <TimelineTrackRow
            key={widget.id}
            row={row}
            layerIndex={index}
            selected={selected}
            isActive={isActive}
            playheadMs={playheadMs}
            rowMsToPx={rowMsToPx}
            trackWidth={trackWidth}
            snapGuideMs={snapGuideMs}
            sceneDurationMs={sceneDurationMs}
            onSelect={(additive) => onSelectWidget(widget.id, additive)}
            onToggleHidden={() => onToggleWidgetHidden(widget.id)}
            onToggleLocked={() => onToggleWidgetLocked(widget.id)}
            onRename={onUpdateWidgetName}
            onReorder={(direction) => onReorderWidget(widget.id, direction)}
            onToggleCollapse={row.isGroup ? () => onToggleGroupCollapse(widget.id) : undefined}
            onDragStart={onDragStart}
            onScrubStart={onScrubStart}
          />
        );
      })}
    </div>
  );
}
