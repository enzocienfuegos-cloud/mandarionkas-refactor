import type { StudioState } from '../../../domain/document/types';
import { buildResolvedWidgetsById } from '../../../domain/document/canvas-variants';

type ResolvedWidgetsById = ReturnType<typeof buildResolvedWidgetsById>;

export type StageDocumentSlice = {
  canvas: StudioState['document']['canvas'];
  scene: StudioState['document']['scenes'][number];
  widgets: ResolvedWidgetsById[string][];
  widgetsById: ResolvedWidgetsById;
  selectedIds: StudioState['document']['selection']['widgetIds'];
};

export type StageUiSlice = {
  zoom: number;
  isPlaying: boolean;
  previewMode: boolean;
  previewContext: StudioState['ui']['previewContext'];
  editModeWireframe: boolean;
  hoveredWidgetId: StudioState['ui']['hoveredWidgetId'];
  activeWidgetId: StudioState['ui']['activeWidgetId'];
  stageBackdrop: StudioState['ui']['stageBackdrop'];
  showStageRulers: boolean;
  showWidgetBadges: boolean;
};

let cachedDocument: StudioState['document'] | null = null;
let cachedStageDocumentSlice: StageDocumentSlice | null = null;

export function selectStageDocument(state: StudioState): StageDocumentSlice {
  const document = state.document;
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

export function selectStageUi(state: StudioState): StageUiSlice {
  return {
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

/** @deprecated Use selectStageDocument + selectStageUi instead. */
export function selectStageState(state: StudioState) {
  return {
    ...selectStageDocument(state),
    ...selectStageUi(state),
  };
}
