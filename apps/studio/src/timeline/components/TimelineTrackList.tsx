import type { RefObject } from 'react';
import { useRef } from 'react';
import { useVirtualWindow, useVirtualWindowPadding } from '../../shared/hooks/use-virtual-window';
import { TimelineEmptyState } from './TimelineEmptyState';
import { TimelineTrackRow } from './TimelineTrackRow';
import type { TimelineDragState, TimelineDisplayRow } from '../types';
import type { KeyframeProperty } from '../../domain/document/types';

export function TimelineTrackList({
  scrollContainerRef,
  displayedWidgets,
  selectedIds,
  playheadMs,
  rowMsToPx,
  trackWidth,
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
  onAddKeyframe,
  onJumpToMs,
  onFocusKeyframe,
  availableKeyframeProperties,
}: {
  scrollContainerRef: RefObject<HTMLDivElement>;
  displayedWidgets: TimelineDisplayRow[];
  selectedIds: string[];
  playheadMs: number;
  rowMsToPx: number;
  trackWidth: number;
  sceneDurationMs: number;
  collapsedGroupIds: string[];
  selectedOnly: boolean;
  onSelectWidget: (widgetId: string, additive?: boolean) => void;
  onToggleWidgetHidden: (widgetId: string) => void;
  onToggleWidgetLocked: (widgetId: string) => void;
  onUpdateWidgetName: (widgetId: string, nextName: string) => void;
  onReorderWidget: (widgetId: string, direction: 'forward' | 'backward' | 'front' | 'back') => void;
  onToggleGroupCollapse: (widgetId: string) => void;
  onDragStart: (drag: Exclude<TimelineDragState, null>) => void;
  onScrubStart: (clientX: number, startMs?: number) => void;
  onAddKeyframe: (widgetId: string, property: KeyframeProperty) => void;
  onJumpToMs: (ms: number) => void;
  onFocusKeyframe: (widgetId: string, keyframeId: string, atMs: number) => void;
  availableKeyframeProperties: KeyframeProperty[];
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
            rowMsToPx={rowMsToPx}
            trackWidth={trackWidth}
            sceneDurationMs={sceneDurationMs}
            onSelectWidget={onSelectWidget}
            onToggleWidgetHidden={onToggleWidgetHidden}
            onToggleWidgetLocked={onToggleWidgetLocked}
            onRename={onUpdateWidgetName}
            onReorderWidget={onReorderWidget}
            onToggleGroupCollapse={row.isGroup ? onToggleGroupCollapse : undefined}
            onDragStart={onDragStart}
            onScrubStart={onScrubStart}
            onAddKeyframe={onAddKeyframe}
            onJumpToMs={onJumpToMs}
            onFocusKeyframe={onFocusKeyframe}
            availableKeyframeProperties={availableKeyframeProperties}
          />
        );
      })}
    </div>
  );
}
