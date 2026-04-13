import type { TimelineDragState, TimelineDisplayRow, TimelineKeyframe, TimelineWidget } from './types';

export const BASE_ROW_MS_TO_PX = 0.03;
export const ROW_GUTTER = 160;
export const MIN_WIDGET_DURATION_MS = 100;

export function formatTime(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function getDisplayTiming(widget: TimelineWidget, drag: TimelineDragState): { startMs: number; endMs: number } {
  if (!drag) return { startMs: widget.timeline.startMs, endMs: widget.timeline.endMs };
  if ((drag.mode === 'move-bar' || drag.mode === 'trim-start' || drag.mode === 'trim-end') && drag.widgetId === widget.id) {
    return { startMs: drag.draftStartMs, endMs: drag.draftEndMs };
  }
  return { startMs: widget.timeline.startMs, endMs: widget.timeline.endMs };
}

export function getDisplayKeyframes(widget: TimelineWidget, drag: TimelineDragState): TimelineKeyframe[] {
  const keyframes = widget.timeline.keyframes ?? [];
  if (!drag || drag.mode !== 'move-keyframe' || drag.widgetId !== widget.id) return keyframes;
  return keyframes
    .map((keyframe) => (keyframe.id === drag.keyframeId ? { ...keyframe, atMs: drag.draftAtMs } : keyframe))
    .sort((a, b) => a.atMs - b.atMs);
}

export function buildRulerTicks(sceneDurationMs: number, rulerStepMs: number, majorTickMs: number): Array<{ atMs: number; isMajor: boolean }> {
  return Array.from({ length: Math.floor(sceneDurationMs / rulerStepMs) + 1 }, (_, index) => {
    const atMs = index * rulerStepMs;
    return {
      atMs,
      isMajor: atMs % majorTickMs === 0,
    };
  });
}

export function buildTimelineDisplayRows(
  widgets: TimelineWidget[],
  selectedIds: string[],
  collapsedGroupIds: Set<string>,
  selectedOnly = false,
): TimelineDisplayRow[] {
  const widgetMap = new Map(widgets.map((widget) => [widget.id, widget]));
  const orderMap = new Map(widgets.map((widget, index) => [widget.id, index]));
  const roots = widgets.filter((widget) => !widget.parentId);
  const rows: TimelineDisplayRow[] = [];

  const shouldIncludeRow = (row: TimelineDisplayRow): boolean => {
    if (!selectedOnly) return true;
    return selectedIds.includes(row.widget.id) || row.ancestorIds.some((ancestorId) => selectedIds.includes(ancestorId));
  };

  const visit = (widget: TimelineWidget, depth: number, ancestorIds: string[]) => {
    const isGroup = widget.type === 'group';
    const childIds = (widget.childIds ?? [])
      .map((childId) => widgetMap.get(childId))
      .filter(Boolean)
      .sort((a, b) => (orderMap.get(a!.id) ?? 0) - (orderMap.get(b!.id) ?? 0)) as TimelineWidget[];
    const row: TimelineDisplayRow = {
      widget,
      timing: { startMs: widget.timeline.startMs, endMs: widget.timeline.endMs },
      keyframes: widget.timeline.keyframes ?? [],
      depth,
      parentGroupId: widget.parentId,
      ancestorIds,
      isGroup,
      childCount: childIds.length,
      isCollapsed: isGroup && collapsedGroupIds.has(widget.id),
    };

    if (shouldIncludeRow(row)) rows.push(row);
    if (row.isCollapsed) return;

    childIds.forEach((child) => visit(child, depth + 1, [...ancestorIds, widget.id]));
  };

  roots.forEach((widget) => visit(widget, 0, []));
  return rows;
}
