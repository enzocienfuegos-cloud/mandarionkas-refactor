import { useCallback } from 'react';
import { usePlatformSnapshot } from '../../platform/runtime';
import { useStudioStore } from '../../core/store/use-studio-store';
import { postVideoAnalyticsEvent } from '../../repositories/video-analytics/api';

export function useVideoAnalyticsReporter(widgetId: string, sceneId: string) {
  const platform = usePlatformSnapshot();
  const projectId = useStudioStore((state) => state.ui.activeProjectId);
  const activeSceneId = useStudioStore((state) => state.document.selection.activeSceneId);
  const releaseTarget = useStudioStore((state) => state.document.metadata.release.targetChannel);

  return useCallback((eventName: string, metadata?: Record<string, unknown>) => {
    void postVideoAnalyticsEvent({
      projectId: projectId || undefined,
      sceneId,
      widgetId,
      eventName,
      metadata: {
        ...(metadata ?? {}),
        activeSceneId,
        releaseTarget,
        workspaceId: platform.session.activeClientId ?? undefined,
        clientId: platform.session.activeClientId ?? undefined,
      },
    }).catch(() => undefined);
  }, [
    activeSceneId,
    platform.session.activeClientId,
    projectId,
    releaseTarget,
    sceneId,
    widgetId,
  ]);
}
