export type HistoryManager<T> = {
  record: (snapshot: T) => void;
  reset: (snapshot: T) => void;
  undo: () => T | null;
  redo: () => T | null;
  canUndo: () => boolean;
  canRedo: () => boolean;
};

/**
 * History manager that stores references to immutable snapshots.
 *
 * IMPORTANT: snapshots passed to `record(...)` are stored by reference.
 * The Studio reducer is immutable, so previously recorded states must never
 * be mutated after dispatch. Do not reintroduce `structuredClone(...)` or
 * deep-clone fallbacks here: they are prohibitively expensive on real Studio
 * documents and block the main thread on every history write.
 */
export function createHistoryManager<T>(maxEntries = 100): HistoryManager<T> {
  let entries: T[] = [];
  let index = -1;

  function push(snapshot: T): void {
    entries = entries.slice(0, index + 1);
    entries.push(snapshot);
    if (entries.length > maxEntries) {
      entries.shift();
    }
    index = entries.length - 1;
  }

  return {
    record(snapshot) {
      push(snapshot);
    },
    reset(snapshot) {
      entries = [];
      index = -1;
      push(snapshot);
    },
    undo() {
      if (index <= 0) return null;
      index -= 1;
      return entries[index] ?? null;
    },
    redo() {
      if (index >= entries.length - 1) return null;
      index += 1;
      return entries[index] ?? null;
    },
    canUndo() {
      return index > 0;
    },
    canRedo() {
      return index >= 0 && index < entries.length - 1;
    },
  };
}
