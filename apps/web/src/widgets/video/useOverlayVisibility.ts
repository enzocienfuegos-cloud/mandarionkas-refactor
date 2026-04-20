import { useCallback, useState } from 'react';

export interface OverlayVisibilityControls {
  hiddenOverlayIds: ReadonlySet<string>;
  forcedOverlayIds: ReadonlySet<string>;
  showOverlay: (id: string) => void;
  hideOverlay: (id: string) => void;
  resetOverlayVisibility: () => void;
}

export function useOverlayVisibility(): OverlayVisibilityControls {
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [forcedIds, setForcedIds] = useState<Set<string>>(new Set());

  const showOverlay = useCallback((id: string) => {
    setHiddenIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setForcedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const hideOverlay = useCallback((id: string) => {
    setForcedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setHiddenIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const resetOverlayVisibility = useCallback(() => {
    setHiddenIds(new Set());
    setForcedIds(new Set());
  }, []);

  return {
    hiddenOverlayIds: hiddenIds,
    forcedOverlayIds: forcedIds,
    showOverlay,
    hideOverlay,
    resetOverlayVisibility,
  };
}
