import { createHistoryManager } from '../history/history-manager';
import { createStore } from './create-store';
import type { StudioCommand } from '../commands/types';
import { createInitialState } from '../../domain/document/factories';
import type { StudioState } from '../../domain/document/types';
import { runActionEffects } from '../../actions/action-effects';
import { getVideoEffectContext } from '../../widgets/video/effect-registry';
import { reduceBySlices } from './reducers';

const history = createHistoryManager<StudioState>(80);

function shouldRecordHistory(command: StudioCommand): boolean {
  switch (command.type) {
    case 'SET_ZOOM':
    case 'SET_PLAYHEAD':
    case 'SET_PLAYING':
    case 'SET_PREVIEW_MODE':
    case 'SET_LEFT_TAB':
    case 'SET_STAGE_BACKDROP':
    case 'SET_STAGE_RULERS':
    case 'SET_ACTIVE_VARIANT':
    case 'SET_ACTIVE_FEED_SOURCE':
    case 'SET_ACTIVE_FEED_RECORD':
    case 'SET_HOVERED_WIDGET':
    case 'SET_ACTIVE_WIDGET':
    case 'SELECT_WIDGET':
    case 'SELECT_WIDGETS':
    case 'SELECT_SCENE':
    case 'GO_TO_NEXT_SCENE':
    case 'GO_TO_PREVIOUS_SCENE':
    case 'MARK_DOCUMENT_AUTOSAVED':
    case 'MARK_DOCUMENT_SAVED':
    case 'EXECUTE_ACTION':
      return false;
    default:
      return true;
  }
}

function reducer(state: StudioState, command: StudioCommand): StudioState {
  if (command.type === 'UNDO') {
    const snapshot = history.undo();
    return snapshot ?? state;
  }

  if (command.type === 'REDO') {
    const snapshot = history.redo();
    return snapshot ?? state;
  }

  const next = reduceBySlices(state, command);
  if (next !== state && shouldRecordHistory(command)) {
    history.record(next);
  }
  return next;
}

export const studioStore = createStore<StudioState, StudioCommand>({
  getInitialState: () => {
    const initial = createInitialState();
    history.reset(initial);
    return initial;
  },
  reduce: reducer,
  afterDispatch(command, previousState, nextState) {
    if (command.type !== 'EXECUTE_ACTION') return;
    const action = previousState.document.actions[command.actionId] ?? nextState.document.actions[command.actionId];
    if (!action) return;
    const effectTargetWidgetId = action.targetWidgetId ?? action.widgetId;
    runActionEffects(action, getVideoEffectContext(effectTargetWidgetId));
  },
});


export function replaceStudioState(nextState: StudioState): void {
  history.reset(nextState);
  studioStore.replaceState(nextState);
}
