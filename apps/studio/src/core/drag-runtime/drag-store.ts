import type { DragSourceConfig, DragState, DragSubscriber } from './types';

export type DragStore = {
  getState(): DragState | null;
  getLastState(): DragState | null;
  subscribe(listener: DragSubscriber): () => void;
  start(source: DragSourceConfig, pointerId: number, x: number, y: number): void;
  update(x: number, y: number): void;
  setDropTarget(id: string | null): void;
  end(phase: 'commit' | 'cancel'): DragState | null;
};

export function createDragStore(): DragStore {
  let currentState: DragState | null = null;
  let lastState: DragState | null = null;
  const listeners = new Set<DragSubscriber>();

  function notify(): void {
    for (const listener of listeners) {
      listener(currentState);
    }
  }

  return {
    getState(): DragState | null {
      return currentState;
    },

    getLastState(): DragState | null {
      return lastState;
    },

    subscribe(listener: DragSubscriber): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    start(source: DragSourceConfig, pointerId: number, x: number, y: number): void {
      currentState = {
        source,
        pointerId,
        startedAt: Date.now(),
        clientX: x,
        clientY: y,
        currentDropTargetId: null,
      };
      notify();
    },

    update(x: number, y: number): void {
      if (!currentState) return;
      currentState = { ...currentState, clientX: x, clientY: y };
      notify();
    },

    setDropTarget(id: string | null): void {
      if (!currentState) return;
      if (currentState.currentDropTargetId === id) return;
      currentState = { ...currentState, currentDropTargetId: id };
      notify();
    },

    end(_phase: 'commit' | 'cancel'): DragState | null {
      lastState = currentState;
      currentState = null;
      notify();
      return lastState;
    },
  };
}
