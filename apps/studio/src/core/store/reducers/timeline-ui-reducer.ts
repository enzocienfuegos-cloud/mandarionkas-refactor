import type { StudioCommand } from '../../commands/types';
import { createId, defaultKeyframeValue } from '../../../domain/document/factories';
import type { ActionNode, StudioState } from '../../../domain/document/types';
import { currentScene, reduceExecutedAction, withDirty } from '../store-utils';

export function timelineUiReducer(state: StudioState, command: StudioCommand): StudioState {
  switch (command.type) {
    case 'SET_ZOOM':
      return { ...state, ui: { ...state.ui, zoom: Math.max(0.25, Math.min(4, command.zoom)) } };
    case 'UPDATE_WIDGET_TIMING': {
      const widget = state.document.widgets[command.widgetId];
      const scene = currentScene(state);
      if (!widget || !scene) return state;
      const startMs = Math.max(0, Math.min(command.patch.startMs ?? widget.timeline.startMs, scene.durationMs));
      const endMs = Math.max(startMs + 100, Math.min(command.patch.endMs ?? widget.timeline.endMs, scene.durationMs));
      return withDirty({ ...state, document: { ...state.document, widgets: { ...state.document.widgets, [widget.id]: { ...widget, timeline: { ...widget.timeline, ...command.patch, startMs, endMs } } } } });
    }
    case 'SET_PLAYHEAD': {
      const scene = currentScene(state);
      const max = scene?.durationMs ?? 15000;
      return { ...state, ui: { ...state.ui, playheadMs: Math.max(0, Math.min(max, command.playheadMs)) } };
    }
    case 'SET_PREVIEW_MODE':
      return { ...state, ui: { ...state.ui, previewMode: command.previewMode, isPlaying: command.previewMode ? state.ui.isPlaying : false, activeWidgetId: undefined } };
    case 'SET_PLAYING':
      return { ...state, ui: { ...state.ui, isPlaying: command.isPlaying } };
    case 'SET_LEFT_TAB':
      return { ...state, ui: { ...state.ui, activeLeftTab: command.tab } };
    case 'SET_STAGE_BACKDROP':
      return { ...state, ui: { ...state.ui, stageBackdrop: command.stageBackdrop } };
    case 'SET_STAGE_RULERS':
      return { ...state, ui: { ...state.ui, showStageRulers: command.enabled } };
    case 'SET_WIDGET_BADGES_VISIBILITY':
      return { ...state, ui: { ...state.ui, showWidgetBadges: command.enabled } };
    case 'SET_HOVERED_WIDGET':
      return { ...state, ui: { ...state.ui, hoveredWidgetId: command.widgetId } };
    case 'SET_ACTIVE_WIDGET':
      return { ...state, ui: { ...state.ui, activeWidgetId: command.widgetId } };
    case 'ADD_KEYFRAME': {
      const widget = state.document.widgets[command.widgetId];
      const scene = currentScene(state);
      if (!widget || !scene) return state;
      const atMs = Math.max(0, Math.min(command.atMs, scene.durationMs));
      const keyframes = widget.timeline.keyframes ?? [];
      const existing = keyframes.find((item) => item.property === command.property && item.atMs === atMs);
      if (existing) return state;
      const keyframe = { id: createId('kf'), atMs, property: command.property, value: defaultKeyframeValue(widget, command.property) };
      return withDirty({ ...state, document: { ...state.document, widgets: { ...state.document.widgets, [widget.id]: { ...widget, timeline: { ...widget.timeline, keyframes: [...keyframes, keyframe].sort((a, b) => a.atMs - b.atMs) } } } } });
    }
    case 'UPDATE_KEYFRAME': {
      const target = state.document.widgets[command.widgetId];
      const scene = currentScene(state);
      if (!target || !scene) return state;
      const keyframes = (target.timeline.keyframes ?? []).map((item) => item.id === command.keyframeId
        ? {
            ...item,
            atMs: command.patch.atMs !== undefined ? Math.max(0, Math.min(command.patch.atMs, scene.durationMs)) : item.atMs,
            value: command.patch.value !== undefined ? command.patch.value : item.value,
            easing: command.patch.easing !== undefined ? command.patch.easing : item.easing,
          }
        : item).sort((a, b) => a.atMs - b.atMs);
      return withDirty({ ...state, document: { ...state.document, widgets: { ...state.document.widgets, [target.id]: { ...target, timeline: { ...target.timeline, keyframes } } } } });
    }
    case 'REMOVE_KEYFRAME': {
      const widget = state.document.widgets[command.widgetId];
      if (!widget) return state;
      return withDirty({ ...state, document: { ...state.document, widgets: { ...state.document.widgets, [widget.id]: { ...widget, timeline: { ...widget.timeline, keyframes: (widget.timeline.keyframes ?? []).filter((item) => item.id !== command.keyframeId) } } } } });
    }
    case 'ADD_WIDGET_ACTION': {
      const actionId = createId('act');
      const action: ActionNode = { id: actionId, widgetId: command.widgetId, trigger: command.trigger ?? 'click', type: command.actionType ?? 'open-url', label: 'Action' };
      return withDirty({ ...state, document: { ...state.document, actions: { ...state.document.actions, [actionId]: action } } });
    }
    case 'UPDATE_WIDGET_ACTION': {
      const target = state.document.actions[command.actionId];
      if (!target) return state;
      return withDirty({ ...state, document: { ...state.document, actions: { ...state.document.actions, [target.id]: { ...target, ...command.patch } } } });
    }
    case 'REMOVE_WIDGET_ACTION': {
      const target = state.document.actions[command.actionId];
      if (!target) return state;
      const actions = { ...state.document.actions };
      delete actions[target.id];
      return withDirty({ ...state, document: { ...state.document, actions } });
    }
    case 'EXECUTE_ACTION': {
      const action = state.document.actions[command.actionId];
      if (!action) return state;
      return reduceExecutedAction(state, action);
    }
    default:
      return state;
  }
}
