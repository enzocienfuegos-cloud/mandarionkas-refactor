import React, { createContext, useContext, useEffect, useRef } from 'react';
import { createDragStore } from './drag-store';
import { createHitTestRegistry } from './hit-test';
import { DragGhostLayer } from './DragGhostLayer';
import type { DragStore } from './drag-store';
import type { HitTestRegistry } from './hit-test';

type DragContextValue = { store: DragStore; hitTest: HitTestRegistry };
const DragContext = createContext<DragContextValue | null>(null);

export function DragProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const store = useRef(createDragStore()).current;
  const hitTest = useRef(createHitTestRegistry()).current;

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      const state = store.getState();
      if (!state || e.pointerId !== state.pointerId) return;
      store.update(e.clientX, e.clientY);
      const dropTargetId = hitTest.hitTest(e.clientX, e.clientY);
      store.setDropTarget(dropTargetId);
    };
    const handlePointerUp = (e: PointerEvent) => {
      const state = store.getState();
      if (!state || e.pointerId !== state.pointerId) return;
      hitTest.stopDrag();
      store.end('commit');
    };
    const handlePointerCancel = (e: PointerEvent) => {
      const state = store.getState();
      if (!state || e.pointerId !== state.pointerId) return;
      hitTest.stopDrag();
      store.end('cancel');
    };
    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerCancel);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerCancel);
    };
  }, [store, hitTest]);

  return (
    <DragContext.Provider value={{ store, hitTest }}>
      {children}
      <DragGhostLayer store={store} />
    </DragContext.Provider>
  );
}

export function useDragContext(): DragContextValue {
  const ctx = useContext(DragContext);
  if (!ctx) throw new Error('useDragContext must be used within DragProvider');
  return ctx;
}
