import { useState, useEffect, useCallback, useRef, type RefCallback } from 'react';
import { useDragContext } from './drag-context';
import type { DragSourceConfig } from './types';

export function useDropTarget(options: {
  targetId: string;
  hitPadding?: number;
  onDrop: (source: DragSourceConfig) => void;
  accepts?: (source: DragSourceConfig) => boolean;
}): {
  isOver: boolean;
  ref: RefCallback<HTMLElement>;
} {
  const { targetId, hitPadding = 0, onDrop, accepts } = options;
  const { store, hitTest } = useDragContext();
  const [isOver, setIsOver] = useState(false);
  const onDropRef = useRef(onDrop);
  const acceptsRef = useRef(accepts);
  onDropRef.current = onDrop;
  acceptsRef.current = accepts;

  useEffect(() => {
    const unsubscribe = store.subscribe((state) => {
      if (state !== null) {
        const over =
          state.currentDropTargetId === targetId &&
          (acceptsRef.current ? acceptsRef.current(state.source) : true);
        setIsOver(over);
      } else {
        setIsOver(false);
        const last = store.getLastState();
        if (
          last &&
          last.currentDropTargetId === targetId &&
          (acceptsRef.current ? acceptsRef.current(last.source) : true)
        ) {
          onDropRef.current(last.source);
        }
      }
    });
    return unsubscribe;
  }, [store, targetId]);

  // Store the unregister cleanup so it runs when the element unmounts (ref called with null).
  // Without this, stale entries accumulated in the hit registry across scene transitions.
  const unregisterRef = useRef<(() => void) | null>(null);

  const ref = useCallback(
    (element: HTMLElement | null) => {
      if (unregisterRef.current) {
        unregisterRef.current();
        unregisterRef.current = null;
      }
      if (element) {
        unregisterRef.current = hitTest.register(targetId, element, { hitPadding });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hitTest, targetId, hitPadding],
  ) as RefCallback<HTMLElement>;

  return { isOver, ref };
}
