import { useMemo } from 'react';
import { shallowEqual, useStudioStore, useStudioStoreSnapshot } from '../../../core/store/use-studio-store';
import type { TopBarStudioSnapshot } from './top-bar-types';

export function useTopBarStudioSnapshot(): TopBarStudioSnapshot {
  const state = useStudioStoreSnapshot();
  const snapshot = useStudioStore((current) => ({
    name: current.document.name,
    dirty: current.document.metadata.dirty,
    selectionCount: current.document.selection.widgetIds.length,
    zoom: current.ui.zoom,
    playhead: current.ui.playheadMs,
    isPlaying: current.ui.isPlaying,
    previewMode: current.ui.previewMode,
    previewContext: current.ui.previewContext,
    editModeWireframe: current.ui.editModeWireframe,
    lastAction: current.ui.lastTriggeredActionLabel,
    activeVariant: current.ui.activeVariant,
    activeFeedSource: current.ui.activeFeedSource,
    activeFeedRecordId: current.ui.activeFeedRecordId,
    activeProjectId: current.ui.activeProjectId,
    activeSceneId: current.document.selection.activeSceneId,
    scenes: current.document.scenes,
    canvasPresetId: current.document.canvas.presetId ?? 'custom',
    release: current.document.metadata.release,
    lastSavedAt: current.document.metadata.lastSavedAt,
    lastAutosavedAt: current.document.metadata.lastAutosavedAt,
    platformMeta: current.document.metadata.platform,
    documentVersion: current.document.version,
  }), shallowEqual);

  return useMemo(() => ({
    state,
    ...snapshot,
  }), [snapshot, state]);
}
