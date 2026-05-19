import { useState, useEffect, useCallback } from 'react';
import type React from 'react';
import { useDragContext } from './drag-context';
import type { DragSourceConfig } from './types';

export function useDragSource(config: DragSourceConfig): {
  isDragging: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
} {
  const { store, hitTest } = useDragContext();
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const unsubscribe = store.subscribe((state) => {
      const active =
        state !== null &&
        state.source.tokenId === config.tokenId &&
        state.source.sourceWidgetId === config.sourceWidgetId;
      setIsDragging(active);
    });
    return unsubscribe;
  }, [store, config.tokenId, config.sourceWidgetId]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation();
      store.start(config, e.pointerId, e.clientX, e.clientY);
      hitTest.beginDrag();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store, hitTest, config.tokenId, config.sourceWidgetId, config.dropTargetId, config.tokenLabel, config.tokenImageUrl, config.payload],
  );

  return { isDragging, onPointerDown };
}
