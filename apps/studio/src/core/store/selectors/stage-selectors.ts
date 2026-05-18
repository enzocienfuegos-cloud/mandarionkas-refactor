import type { StudioState } from '../../../domain/document/types';
import { buildResolvedWidgetsById } from '../../../domain/document/canvas-variants';

export function selectStageState(state: StudioState) {
  const widgetsById = buildResolvedWidgetsById(state.document);
  const activeScene = state.document.scenes.find((item) => item.id === state.document.selection.activeSceneId) ?? state.document.scenes[0];
  const sceneWidgets = activeScene.widgetIds
    .map((id) => widgetsById[id])
    .filter(Boolean)
    .sort((a, b) => a.zIndex - b.zIndex);
  return {
    canvas: state.document.canvas,
    scene: activeScene,
    widgets: sceneWidgets,
    widgetsById,
    selectedIds: state.document.selection.widgetIds,
    zoom: state.ui.zoom,
    isPlaying: state.ui.isPlaying,
    previewMode: state.ui.previewMode,
    previewContext: state.ui.previewContext,
    editModeWireframe: state.ui.editModeWireframe,
    hoveredWidgetId: state.ui.hoveredWidgetId,
    activeWidgetId: state.ui.activeWidgetId,
    stageBackdrop: state.ui.stageBackdrop,
    showStageRulers: state.ui.showStageRulers,
    showWidgetBadges: state.ui.showWidgetBadges,
  };
}
