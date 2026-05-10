import { TimelineTrackRow } from './TimelineTrackRow';
import type { TimelineDragState, TimelineDisplayRow } from '../types';

export function TimelineTrackList({
  displayedWidgets,
  selectedIds,
  playheadMs,
  playheadLeft,
  rowMsToPx,
  trackWidth,
  snapGuideMs,
  collapsedGroupIds,
  onSelectWidget,
  onToggleWidgetHidden,
  onToggleWidgetLocked,
  onUpdateWidgetName,
  onReorderWidget,
  onToggleGroupCollapse,
  onDragStart,
}: {
  displayedWidgets: TimelineDisplayRow[];
  selectedIds: string[];
  playheadMs: number;
  playheadLeft: number;
  rowMsToPx: number;
  trackWidth: number;
  snapGuideMs?: number;
  collapsedGroupIds: string[];
  onSelectWidget: (widgetId: string, additive?: boolean) => void;
  onToggleWidgetHidden: (widgetId: string) => void;
  onToggleWidgetLocked: (widgetId: string) => void;
  onUpdateWidgetName: (widgetId: string, nextName: string) => void;
  onReorderWidget: (widgetId: string, direction: 'forward' | 'backward') => void;
  onToggleGroupCollapse: (widgetId: string) => void;
  onDragStart: (drag: Exclude<TimelineDragState, null>) => void;
}): JSX.Element {
  return (
    <div className="timeline-rows" data-collapsed-groups={collapsedGroupIds.length}>
      {displayedWidgets.map((row) => {
        const { widget, timing } = row;
        const selected = selectedIds.includes(widget.id);
        const isActive = playheadMs >= timing.startMs && playheadMs <= timing.endMs;
        return (
          <TimelineTrackRow
            key={widget.id}
            row={row}
            selected={selected}
            isActive={isActive}
            playheadMs={playheadMs}
            playheadLeft={playheadLeft}
            rowMsToPx={rowMsToPx}
            trackWidth={trackWidth}
            snapGuideMs={snapGuideMs}
            onSelect={(additive) => onSelectWidget(widget.id, additive)}
            onToggleHidden={() => onToggleWidgetHidden(widget.id)}
            onToggleLocked={() => onToggleWidgetLocked(widget.id)}
            onRename={onUpdateWidgetName}
            onReorder={(direction) => onReorderWidget(widget.id, direction)}
            onToggleCollapse={row.isGroup ? () => onToggleGroupCollapse(widget.id) : undefined}
            onDragStart={onDragStart}
          />
        );
      })}
    </div>
  );
}
