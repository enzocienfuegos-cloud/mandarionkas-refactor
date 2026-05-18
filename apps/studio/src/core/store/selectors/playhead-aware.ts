import type { BindingSource, StudioState, VariantName } from '../../../domain/document/types';
import type { PreviewFrameId } from '../../../domain/preview/preview-frames';

/**
 * Snapshot estructural para UI del editor.
 * Nunca incluir playhead o flags que mutan por playback aquí.
 */
export type DocumentStructuralSnapshot = {
  documentName: string;
  documentVersion: number;
  dirty: boolean;
  lastSavedAt?: string;
  lastAutosavedAt?: string;
  activeSceneId: string;
  scenes: StudioState['document']['scenes'];
  activeVariant: VariantName;
  activeProjectId?: string;
  previewMode: boolean;
  previewContext: PreviewFrameId;
  editModeWireframe: boolean;
  zoom: number;
  canvasPresetId: string;
  release: StudioState['document']['metadata']['release'];
  platformMeta: StudioState['document']['metadata']['platform'];
  activeFeedSource: BindingSource;
  activeFeedRecordId: string;
  selectionCount: number;
};

export function selectDocumentStructuralSnapshot(state: StudioState): DocumentStructuralSnapshot {
  return {
    documentName: state.document.name,
    documentVersion: state.document.version,
    dirty: state.document.metadata.dirty,
    lastSavedAt: state.document.metadata.lastSavedAt,
    lastAutosavedAt: state.document.metadata.lastAutosavedAt,
    activeSceneId: state.document.selection.activeSceneId,
    scenes: state.document.scenes,
    activeVariant: state.ui.activeVariant,
    activeProjectId: state.ui.activeProjectId,
    previewMode: state.ui.previewMode,
    previewContext: state.ui.previewContext,
    editModeWireframe: state.ui.editModeWireframe,
    zoom: state.ui.zoom,
    canvasPresetId: state.document.canvas.presetId ?? 'custom',
    release: state.document.metadata.release,
    platformMeta: state.document.metadata.platform,
    activeFeedSource: state.ui.activeFeedSource,
    activeFeedRecordId: state.ui.activeFeedRecordId,
    selectionCount: state.document.selection.widgetIds.length,
  };
}
