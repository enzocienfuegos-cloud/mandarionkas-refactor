import type { ActionNode, StudioState, WidgetNode } from '../../../../domain/document/types';
import { createId, cloneWidget } from '../../../../domain/document/factories';
import { computeGroupFrame, currentScene, expandSelectionIds, getPlacedFrameForPoint, getSelectedWidgets, getSmartPlacedFrame, normalizeSceneOrdering, withDirty } from '../../store-utils';
import { getWidgetDefinition } from '../../../../widgets/registry/widget-registry';

export type WidgetReducer = (state: StudioState, command: any) => StudioState;

export { cloneWidget, createId, computeGroupFrame, currentScene, expandSelectionIds, getPlacedFrameForPoint, getSelectedWidgets, getSmartPlacedFrame, normalizeSceneOrdering, withDirty, getWidgetDefinition };

export function removeActionsForWidgets(actions: Record<string, ActionNode>, widgetIds: string[]) {
  const next = { ...actions };
  Object.values(next).forEach((action) => {
    if (widgetIds.includes(action.widgetId) || (action.targetWidgetId && widgetIds.includes(action.targetWidgetId))) {
      delete next[action.id];
    }
  });
  return next;
}

export function cloneActionsForWidgetMap(actions: Record<string, ActionNode>, idMap: Map<string, string>) {
  const next = { ...actions };
  Object.values(actions).forEach((action) => {
    const mappedWidgetId = idMap.get(action.widgetId);
    if (!mappedWidgetId) return;
    const mappedTargetWidgetId = action.targetWidgetId ? (idMap.get(action.targetWidgetId) ?? action.targetWidgetId) : undefined;
    const copyId = createId('act');
    next[copyId] = { ...action, id: copyId, widgetId: mappedWidgetId, targetWidgetId: mappedTargetWidgetId };
  });
  return next;
}

export function composeWidgetReducers(...reducers: WidgetReducer[]): WidgetReducer {
  return (state, command) => reducers.reduce((next, reducer) => reducer(next, command), state);
}
