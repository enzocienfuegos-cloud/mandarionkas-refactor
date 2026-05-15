import type { StudioCommand } from '../../../commands/types';
import type { StudioState, WidgetNode } from '../../../../domain/document/types';
import { withDirty } from './shared';

function collectWidgetTreeIds(widget: WidgetNode, widgets: StudioState['document']['widgets'], visited = new Set<string>()): string[] {
  if (visited.has(widget.id)) return [];
  visited.add(widget.id);
  const ids = [widget.id];
  (widget.childIds ?? []).forEach((childId) => {
    const child = widgets[childId];
    if (!child) return;
    ids.push(...collectWidgetTreeIds(child, widgets, visited));
  });
  return ids;
}

export function widgetVisibilityReducer(state: StudioState, command: StudioCommand): StudioState {
  switch (command.type) {
    case 'TOGGLE_WIDGET_HIDDEN':
    case 'TOGGLE_WIDGET_LOCKED': {
      const widget = state.document.widgets[command.widgetId];
      if (!widget) return state;
      const field = command.type === 'TOGGLE_WIDGET_HIDDEN' ? 'hidden' : 'locked';
      const targetIds = collectWidgetTreeIds(widget, state.document.widgets);
      const allEnabled = targetIds.every((widgetId) => Boolean(state.document.widgets[widgetId]?.[field]));
      const nextValue = widget.childIds?.length ? !allEnabled : !widget[field];
      const widgets = { ...state.document.widgets };
      targetIds.forEach((widgetId) => {
        const target = widgets[widgetId];
        if (!target) return;
        widgets[widgetId] = { ...target, [field]: nextValue };
      });
      return withDirty({ ...state, document: { ...state.document, widgets } });
    }
    default:
      return state;
  }
}
