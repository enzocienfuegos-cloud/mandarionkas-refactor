import { useMemo } from 'react';
import { selectDocumentStructuralSnapshot } from '../../../core/store/selectors/playhead-aware';
import { shallowEqual, useStudioStore, useStudioStoreSnapshot } from '../../../core/store/use-studio-store';
import { usePlaybackMsThrottled } from '../../../hooks/use-playback-engine';
import type { TopBarStudioSnapshot } from './top-bar-types';

export function useTopBarStudioSnapshot(): TopBarStudioSnapshot {
  const state = useStudioStoreSnapshot();
  const snapshot = useStudioStore(selectDocumentStructuralSnapshot, shallowEqual);
  const lastAction = useStudioStore((current) => current.ui.lastTriggeredActionLabel);
  const isPlaying = useStudioStore((current) => current.ui.isPlaying);
  const storePlayheadMs = useStudioStore((current) => current.ui.playheadMs);
  const playhead = usePlaybackMsThrottled(storePlayheadMs);

  return useMemo(() => ({
    state,
    name: snapshot.documentName,
    dirty: snapshot.dirty,
    selectionCount: snapshot.selectionCount,
    zoom: snapshot.zoom,
    playhead,
    isPlaying,
    previewMode: snapshot.previewMode,
    previewContext: snapshot.previewContext,
    editModeWireframe: snapshot.editModeWireframe,
    lastAction,
    activeVariant: snapshot.activeVariant,
    activeFeedSource: snapshot.activeFeedSource,
    activeFeedRecordId: snapshot.activeFeedRecordId,
    activeProjectId: snapshot.activeProjectId,
    activeSceneId: snapshot.activeSceneId,
    scenes: snapshot.scenes,
    canvasPresetId: snapshot.canvasPresetId,
    release: snapshot.release,
    lastSavedAt: snapshot.lastSavedAt,
    lastAutosavedAt: snapshot.lastAutosavedAt,
    platformMeta: snapshot.platformMeta,
    documentVersion: snapshot.documentVersion,
  }), [isPlaying, lastAction, playhead, snapshot, state]);
}
