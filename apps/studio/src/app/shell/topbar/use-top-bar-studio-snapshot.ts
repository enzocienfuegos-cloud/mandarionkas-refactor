import { useMemo } from 'react';
import { useStudioStore } from '../../../core/store/use-studio-store';
import type { TopBarStudioSnapshot } from './top-bar-types';

export function useTopBarStudioSnapshot(): TopBarStudioSnapshot {
  const state = useStudioStore((value) => value);

  return useMemo(() => ({
    state,
    name: state.document.name,
    dirty: state.document.metadata.dirty,
    selectionCount: state.document.selection.widgetIds.length,
    zoom: state.ui.zoom,
    playhead: state.ui.playheadMs,
    isPlaying: state.ui.isPlaying,
    previewMode: state.ui.previewMode,
    lastAction: state.ui.lastTriggeredActionLabel,
    activeVariant: state.ui.activeVariant,
    activeFeedSource: state.ui.activeFeedSource,
    activeFeedRecordId: state.ui.activeFeedRecordId,
    activeProjectId: state.ui.activeProjectId,
    activeSceneId: state.document.selection.activeSceneId,
    scenes: state.document.scenes,
    canvasPresetId: state.document.canvas.presetId ?? 'custom',
    release: state.document.metadata.release,
    lastSavedAt: state.document.metadata.lastSavedAt,
    lastAutosavedAt: state.document.metadata.lastAutosavedAt,
    platformMeta: state.document.metadata.platform,
    documentVersion: state.document.version,
  }), [state]);
}
