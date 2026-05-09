import { useCallback, useEffect, useRef } from 'react';

type DragHandlers = {
  onMove: (event: PointerEvent) => void;
  onUp?: (event: PointerEvent) => void;
};

export function useShellResize() {
  const activeRef = useRef<DragHandlers | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastEventRef = useRef<PointerEvent | null>(null);

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      lastEventRef.current = event;
      if (!activeRef.current || rafRef.current !== null) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        const handler = activeRef.current;
        const lastEvent = lastEventRef.current;
        if (handler && lastEvent) {
          handler.onMove(lastEvent);
        }
      });
    };

    const onUp = (event: PointerEvent) => {
      const handler = activeRef.current;
      activeRef.current = null;
      lastEventRef.current = null;
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      handler?.onUp?.(event);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);

    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
      activeRef.current = null;
      lastEventRef.current = null;
    };
  }, []);

  const begin = useCallback((handlers: DragHandlers) => {
    activeRef.current = handlers;
    lastEventRef.current = null;
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  return { begin };
}
