import type { StudioState } from '../../domain/document/types';

export function createPersistenceSnapshot(state: StudioState): StudioState {
  return {
    document: {
      ...state.document,
      metadata: {
        ...state.document.metadata,
        dirty: state.document.metadata.dirty,
        lastSavedAt: state.document.metadata.lastSavedAt,
        lastAutosavedAt: undefined,
      },
    },
    ui: {
      ...state.ui,
      playheadMs: 0,
      isPlaying: false,
      previewMode: false,
      hoveredWidgetId: undefined,
      activeWidgetId: undefined,
      lastTriggeredActionLabel: undefined,
    },
  };
}

export function createPersistenceSignature(state: StudioState): string {
  return JSON.stringify(createPersistenceSnapshot(state));
}
