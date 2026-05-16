import { TimelineEmptyState } from './TimelineEmptyState';
import { TimelineTrackRow } from './TimelineTrackRow';
import type { TimelineDragState, TimelineDisplayRow } from '../types';
import type { KeyframeProperty } from '../../domain/document/types';

export function TimelineTrackList({
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
  if (!displayedWidgets.length) {
    return (
      <div className="timeline-rows timeline-rows--empty" data-collapsed-groups={collapsedGroupIds.length}>
        <TimelineEmptyState selectedOnly={selectedOnly} />
      </div>
    );
  }

  return (
    <div className="timeline-rows" data-collapsed-groups={collapsedGroupIds.length}>
      {displayedWidgets.map((row, index) => {
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
