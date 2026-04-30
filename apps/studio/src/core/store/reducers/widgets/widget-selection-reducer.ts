import type { StudioCommand } from '../../../commands/types';
import type { StudioState } from '../../../../domain/document/types';

export function widgetSelectionReducer(state: StudioState, command: StudioCommand): StudioState {
  switch (command.type) {
    case 'SELECT_WIDGET': {
      if (!command.widgetId) {
        return { ...state, document: { ...state.document, selection: { ...state.document.selection, widgetIds: [], primaryWidgetId: undefined } } };
      }
      const currentSelection = state.document.selection.widgetIds;
      let nextIds = [command.widgetId];
      if (command.additive) {
        nextIds = currentSelection.includes(command.widgetId)
          ? currentSelection.filter((id) => id !== command.widgetId)
          : [...currentSelection, command.widgetId];
      }
      return { ...state, document: { ...state.document, selection: { ...state.document.selection, widgetIds: nextIds, primaryWidgetId: command.widgetId } } };
    }
    case 'SELECT_WIDGETS':
      return { ...state, document: { ...state.document, selection: { ...state.document.selection, widgetIds: command.widgetIds, primaryWidgetId: command.primaryWidgetId ?? command.widgetIds[0] } } };
    default:
      return state;
  }
}
