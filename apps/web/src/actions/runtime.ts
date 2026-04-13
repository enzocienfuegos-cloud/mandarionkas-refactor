import type { ActionNode, StudioState } from '../domain/document/types';

export function getWidgetActions(state: StudioState, widgetId: string, trigger: ActionNode['trigger']): ActionNode[] {
  return Object.values(state.document.actions)
    .filter((action) => action.widgetId === widgetId && action.trigger === trigger);
}

export function getTimelineEnterActions(state: StudioState, playheadMs: number, previousPlayheadMs: number): ActionNode[] {
  if (playheadMs <= previousPlayheadMs) return [];
  return Object.values(state.document.actions).filter((action) => {
    if (action.trigger !== 'timeline-enter') return false;
    const widget = state.document.widgets[action.widgetId];
    if (!widget) return false;
    return previousPlayheadMs < widget.timeline.startMs && playheadMs >= widget.timeline.startMs;
  });
}
