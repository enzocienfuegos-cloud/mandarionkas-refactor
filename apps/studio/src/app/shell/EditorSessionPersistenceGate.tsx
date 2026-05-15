import { useEffect } from 'react';
import { useStudioStore } from '../../core/store/use-studio-store';
import { usePlatformSnapshot } from '../../platform/runtime';
import { writeEditorSessionSnapshot } from './editor-session-storage';

export function EditorSessionPersistenceGate({ enabled }: { enabled: boolean }): null {
  const activeProjectId = useStudioStore((state) => state.ui.activeProjectId);
  const activeCanvasVariantId = useStudioStore((state) => state.document.activeCanvasVariantId);
  const dirty = useStudioStore((state) => state.document.metadata.dirty);
  const lastSavedAt = useStudioStore((state) => state.document.metadata.lastSavedAt);
  const platform = usePlatformSnapshot();

  useEffect(() => {
    if (!enabled) return;
    if (!activeProjectId && !dirty && !lastSavedAt) return;
    writeEditorSessionSnapshot({
      projectId: activeProjectId,
      clientId: platform.session.activeClientId,
      canvasVariantId: activeCanvasVariantId,
    });
  }, [activeCanvasVariantId, activeProjectId, dirty, enabled, lastSavedAt, platform.session.activeClientId]);

  return null;
}
