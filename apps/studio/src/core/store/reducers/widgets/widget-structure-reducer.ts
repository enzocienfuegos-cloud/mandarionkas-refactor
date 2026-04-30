import type { StudioCommand } from '../../../commands/types';
import type { StudioState, WidgetNode } from '../../../../domain/document/types';
import { cloneActionsForWidgetMap, cloneWidget, computeGroupFrame, createId, currentScene, getSelectedWidgets, normalizeSceneOrdering, removeActionsForWidgets, withDirty } from './shared';

export function widgetStructureReducer(state: StudioState, command: StudioCommand): StudioState {
  switch (command.type) {
    case 'GROUP_SELECTED_WIDGETS': {
      const selected = getSelectedWidgets(state).filter((widget) => widget.type !== 'group' && !widget.parentId);
      const scene = currentScene(state);
      if (!scene || selected.length < 2) return state;
      const widgets = { ...state.document.widgets };
      const groupId = createId('group');
      widgets[groupId] = {
        id: groupId,
        type: 'group',
        name: `Group ${selected.length}`,
        sceneId: scene.id,
        zIndex: scene.widgetIds.length,
        frame: computeGroupFrame(selected),
        props: { title: 'Group' },
        style: { backgroundColor: 'transparent', accentColor: '#8b5cf6', color: '#ffffff' },
        timeline: { startMs: Math.min(...selected.map((widget) => widget.timeline.startMs)), endMs: Math.max(...selected.map((widget) => widget.timeline.endMs)) },
        childIds: selected.map((widget) => widget.id),
      } as WidgetNode;
      selected.forEach((widget) => {
        widgets[widget.id] = { ...widgets[widget.id], parentId: groupId };
      });
      return withDirty({
        ...state,
        document: {
          ...state.document,
          widgets,
          scenes: state.document.scenes.map((item) => item.id === scene.id ? { ...item, widgetIds: [...item.widgetIds, groupId] } : item),
          selection: { ...state.document.selection, widgetIds: [groupId], primaryWidgetId: groupId },
        },
      });
    }
    case 'UNGROUP_SELECTED_WIDGETS': {
      const selectedGroups = getSelectedWidgets(state).filter((widget) => widget.type === 'group');
      if (!selectedGroups.length) return state;
      const widgets = { ...state.document.widgets };
      const selectionIds: string[] = [];
      selectedGroups.forEach((group) => {
        (group.childIds ?? []).forEach((childId) => {
          const child = widgets[childId];
          if (!child) return;
          widgets[childId] = { ...child, parentId: undefined };
          selectionIds.push(childId);
        });
        delete widgets[group.id];
      });
      const actions = removeActionsForWidgets(state.document.actions, selectedGroups.map((group) => group.id));
      return withDirty({
        ...state,
        document: {
          ...state.document,
          widgets,
          actions,
          scenes: state.document.scenes.map((scene) => normalizeSceneOrdering({ ...scene, widgetIds: scene.widgetIds.filter((id) => !selectedGroups.some((group) => group.id === id)) }, widgets).scene),
          selection: { ...state.document.selection, widgetIds: selectionIds, primaryWidgetId: selectionIds[0] },
        },
      });
    }
    case 'DELETE_SELECTED_WIDGETS': {
      const selectedIds = [...new Set(getSelectedWidgets(state).flatMap((widget) => [widget.id, ...(widget.childIds ?? [])]))];
      if (!selectedIds.length) return state;
      const widgets = { ...state.document.widgets };
      selectedIds.forEach((widgetId) => delete widgets[widgetId]);
      Object.values(widgets).forEach((widget) => {
        if (widget.childIds?.length) widgets[widget.id] = { ...widget, childIds: widget.childIds.filter((id) => !selectedIds.includes(id)) };
      });
      const actions = removeActionsForWidgets(state.document.actions, selectedIds);
      return withDirty({
        ...state,
        document: {
          ...state.document,
          widgets,
          actions,
          scenes: state.document.scenes.map((item) => item.id === state.document.selection.activeSceneId ? normalizeSceneOrdering({ ...item, widgetIds: item.widgetIds.filter((id) => !selectedIds.includes(id)) }, widgets).scene : item),
          selection: { ...state.document.selection, widgetIds: [], primaryWidgetId: undefined },
        },
      });
    }
    case 'DUPLICATE_SELECTED_WIDGETS': {
      const scene = currentScene(state);
      if (!scene) return state;
      const selected = getSelectedWidgets(state);
      if (!selected.length) return state;
      const widgets = { ...state.document.widgets };
      const idMap = new Map<string, string>();
      const clones: WidgetNode[] = selected.map((source, index) => {
        const clone = cloneWidget(source, selected.length > 1 ? `${source.name} Copy ${index + 1}` : undefined);
        idMap.set(source.id, clone.id);
        return clone;
      });
      clones.forEach((clone, index) => {
        const source = selected[index];
        if (source.parentId && idMap.get(source.parentId)) clone.parentId = idMap.get(source.parentId);
        if (source.childIds?.length) clone.childIds = source.childIds.map((childId) => idMap.get(childId) ?? childId);
        widgets[clone.id] = clone;
      });
      const actions = cloneActionsForWidgetMap(state.document.actions, idMap);
      return withDirty({
        ...state,
        document: {
          ...state.document,
          widgets,
          actions,
          scenes: state.document.scenes.map((item) => item.id === scene.id ? { ...item, widgetIds: [...item.widgetIds, ...clones.map((clone) => clone.id)] } : item),
          selection: { ...state.document.selection, widgetIds: clones.map((clone) => clone.id), primaryWidgetId: clones[0]?.id },
        },
      });
    }
    case 'PASTE_WIDGET_CLIPBOARD': {
      const scene = currentScene(state);
      if (!scene || !command.clipboard.widgets.length) return state;
      const widgets = { ...state.document.widgets };
      const idMap = new Map<string, string>();
      const clones: WidgetNode[] = command.clipboard.widgets.map((source, index) => {
        const clone = cloneWidget({ ...source, sceneId: scene.id }, source.name, { preserveFrame: true });
        idMap.set(source.id, clone.id);
        clone.zIndex = scene.widgetIds.length + index;
        return clone;
      });
      clones.forEach((clone, index) => {
        const source = command.clipboard.widgets[index];
        if (source.parentId) clone.parentId = idMap.get(source.parentId);
        if (source.childIds?.length) clone.childIds = source.childIds.map((childId) => idMap.get(childId) ?? childId);
        widgets[clone.id] = clone;
      });
      const clipboardActionMap = Object.fromEntries(command.clipboard.actions.map((action) => [action.id, action]));
      const clonedActions = cloneActionsForWidgetMap(clipboardActionMap, idMap);
      const actions = { ...state.document.actions, ...Object.fromEntries(Object.entries(clonedActions).filter(([actionId]) => !clipboardActionMap[actionId])) };
      return withDirty({
        ...state,
        document: {
          ...state.document,
          widgets,
          actions,
          scenes: state.document.scenes.map((item) => item.id === scene.id ? { ...item, widgetIds: [...item.widgetIds, ...clones.map((clone) => clone.id)] } : item),
          selection: { ...state.document.selection, widgetIds: clones.map((clone) => clone.id), primaryWidgetId: clones[0]?.id },
        },
      });
    }
    case 'REORDER_WIDGET': {
      const scene = currentScene(state);
      if (!scene) return state;
      const currentIndex = scene.widgetIds.indexOf(command.widgetId);
      if (currentIndex === -1) return state;
      const ids = [...scene.widgetIds];
      const [moved] = ids.splice(currentIndex, 1);
      let nextIndex = currentIndex;
      if (command.direction === 'forward') nextIndex = Math.min(ids.length, currentIndex + 1);
      if (command.direction === 'backward') nextIndex = Math.max(0, currentIndex - 1);
      if (command.direction === 'front') nextIndex = ids.length;
      if (command.direction === 'back') nextIndex = 0;
      ids.splice(nextIndex, 0, moved);
      const normalized = normalizeSceneOrdering({ ...scene, widgetIds: ids }, state.document.widgets);
      return withDirty({ ...state, document: { ...state.document, widgets: normalized.widgets, scenes: state.document.scenes.map((item) => item.id === scene.id ? normalized.scene : item) } });
    }
    default:
      return state;
  }
}
