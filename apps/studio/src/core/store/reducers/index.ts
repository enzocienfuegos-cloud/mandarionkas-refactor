import type { StudioCommand } from '../../commands/types';
import type { StudioState } from '../../../domain/document/types';
import { collabMetadataReducer } from './collab-metadata-reducer';
import { documentSceneReducer } from './document-scene-reducer';
import { timelineUiReducer } from './timeline-ui-reducer';
import { widgetReducer } from './widget-reducer';

export type StudioReducer = (state: StudioState, command: StudioCommand) => StudioState;

const reducers: StudioReducer[] = [
  documentSceneReducer,
  widgetReducer,
  timelineUiReducer,
  collabMetadataReducer,
];

export function reduceBySlices(state: StudioState, command: StudioCommand): StudioState {
  return reducers.reduce((nextState, reducer) => reducer(nextState, command), state);
}
