import type { StudioState } from '../../../domain/document/types';

export function selectStageState(state: StudioState) {
  const activeScene = state.document.scenes.find((item) => item.id === state.document.selection.activeSceneId) ?? state.document.scenes[0];
  const sceneWidgets = activeScene.widgetIds
    .map((id) => state.document.widgets[id])
    .filter(Boolean)
    .sort((a, b) => a.zIndex - b.zIndex);
  return {
    canvas: state.document.canvas,
    scene: activeScene,
    widgets: sceneWidgets,
    widgetsById: state.document.widgets,
    selectedIds: state.document.selection.widgetIds,
    zoom: state.ui.zoom,
    playheadMs: state.ui.playheadMs,
    isPlaying: state.ui.isPlaying,
    previewMode: state.ui.previewMode,
    hoveredWidgetId: state.ui.hoveredWidgetId,
    activeWidgetId: state.ui.activeWidgetId,
    stageBackdrop: state.ui.stageBackdrop,
    showStageRulers: state.ui.showStageRulers,
  };
}
