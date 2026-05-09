import type { StudioCommand } from '../../../commands/types';
import type { StudioState } from '../../../../domain/document/types';
import { composeWidgetReducers } from './shared';
import { widgetCreateUpdateReducer } from './widget-create-update-reducer';
import { widgetFrameReducer } from './widget-frame-reducer';
import { widgetSelectionReducer } from './widget-selection-reducer';
import { widgetStructureReducer } from './widget-structure-reducer';
import { widgetVisibilityReducer } from './widget-visibility-reducer';

const reducer = composeWidgetReducers(
  widgetSelectionReducer,
  widgetCreateUpdateReducer,
  widgetFrameReducer,
  widgetStructureReducer,
  widgetVisibilityReducer,
);

export function widgetReducer(state: StudioState, command: StudioCommand): StudioState {
  return reducer(state, command);
}
