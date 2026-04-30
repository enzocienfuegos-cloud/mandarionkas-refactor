import type { StudioCommand } from '../../../commands/types';
import type { StudioState } from '../../../../domain/document/types';
import { withDirty } from './shared';

export function widgetVisibilityReducer(state: StudioState, command: StudioCommand): StudioState {
  switch (command.type) {
    case 'TOGGLE_WIDGET_HIDDEN':
    case 'TOGGLE_WIDGET_LOCKED': {
      const widget = state.document.widgets[command.widgetId];
      if (!widget) return state;
      const field = command.type === 'TOGGLE_WIDGET_HIDDEN' ? 'hidden' : 'locked';
      const nextValue = !widget[field];
      const widgets = { ...state.document.widgets, [widget.id]: { ...widget, [field]: nextValue } };
      if (widget.childIds?.length) {
        widget.childIds.forEach((childId) => {
          const child = widgets[childId];
          if (!child) return;
          widgets[childId] = { ...child, [field]: nextValue };
        });
      }
      return withDirty({ ...state, document: { ...state.document, widgets } });
    }
    default:
      return state;
  }
}
