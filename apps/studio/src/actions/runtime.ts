import type { ActionNode, StudioState } from '../domain/document/types';

export function getWidgetActions(state: StudioState, widgetId: string, trigger: ActionNode['trigger']): ActionNode[] {
  return Object.values(state.document.actions)
    .filter((action) => !action.disabled && action.widgetId === widgetId && action.trigger === trigger);
}

export function getTimelineEnterActions(state: StudioState, playheadMs: number, previousPlayheadMs: number): ActionNode[] {
  if (playheadMs <= previousPlayheadMs) return [];
  return Object.values(state.document.actions).filter((action) => {
    if (action.disabled) return false;
    if (action.trigger !== 'timeline-enter') return false;
    const widget = state.document.widgets[action.widgetId];
    if (!widget) return false;
    return previousPlayheadMs < widget.timeline.startMs && playheadMs >= widget.timeline.startMs;
  });
}

export function getTimelineExitActions(state: StudioState, playheadMs: number, previousPlayheadMs: number): ActionNode[] {
  if (playheadMs <= previousPlayheadMs) return [];
  return Object.values(state.document.actions).filter((action) => {
    if (action.disabled) return false;
    if (action.trigger !== 'timeline-exit') return false;
    const widget = state.document.widgets[action.widgetId];
    if (!widget || widget.timeline.endMs === undefined) return false;
    return previousPlayheadMs < widget.timeline.endMs && playheadMs >= widget.timeline.endMs;
  });
}

export function getTimelineActions(state: StudioState, playheadMs: number, previousPlayheadMs: number): ActionNode[] {
  return [
    ...getTimelineEnterActions(state, playheadMs, previousPlayheadMs),
    ...getTimelineExitActions(state, playheadMs, previousPlayheadMs),
  ];
}
