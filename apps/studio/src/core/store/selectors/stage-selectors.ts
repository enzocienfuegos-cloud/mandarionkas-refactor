import type { StudioState } from '../../../domain/document/types';
import { buildResolvedWidgetsById } from '../../../domain/document/canvas-variants';

type StageDocumentSlice = {
  canvas: StudioState['document']['canvas'];
  scene: StudioState['document']['scenes'][number];
  widgets: ReturnType<typeof buildResolvedWidgetsById>[string][];
  widgetsById: ReturnType<typeof buildResolvedWidgetsById>;
  selectedIds: StudioState['document']['selection']['widgetIds'];
};

let cachedDocument: StudioState['document'] | null = null;
let cachedStageDocumentSlice: StageDocumentSlice | null = null;

function getStageDocumentSlice(document: StudioState['document']): StageDocumentSlice {
  if (cachedDocument === document && cachedStageDocumentSlice) {
    return cachedStageDocumentSlice;
  }

  const widgetsById = buildResolvedWidgetsById(document);
  const activeScene = document.scenes.find((item) => item.id === document.selection.activeSceneId) ?? document.scenes[0];
  const sceneWidgets = activeScene.widgetIds
    .map((id) => widgetsById[id])
    .filter(Boolean)
    .sort((a, b) => a.zIndex - b.zIndex);

  cachedDocument = document;
  cachedStageDocumentSlice = {
    canvas: document.canvas,
    scene: activeScene,
    widgets: sceneWidgets,
    widgetsById,
    selectedIds: document.selection.widgetIds,
  };
  return cachedStageDocumentSlice;
}

export function selectStageState(state: StudioState) {
  const documentSlice = getStageDocumentSlice(state.document);
  return {
    ...documentSlice,
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
