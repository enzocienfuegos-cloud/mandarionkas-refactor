export type HistoryManager<T> = {
  record: (snapshot: T) => void;
  reset: (snapshot: T) => void;
  undo: () => T | null;
  redo: () => T | null;
  canUndo: () => boolean;
  canRedo: () => boolean;
};

function cloneSnapshot<T>(snapshot: T): T {
  return typeof structuredClone === 'function' ? structuredClone(snapshot) : snapshot;
}

export function createHistoryManager<T>(maxEntries = 100): HistoryManager<T> {
  let entries: T[] = [];
  let index = -1;

  function push(snapshot: T): void {
    entries = entries.slice(0, index + 1);
    entries.push(cloneSnapshot(snapshot));
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
      return entries[index] ? cloneSnapshot(entries[index]) : null;
    },
    redo() {
      if (index >= entries.length - 1) return null;
      index += 1;
      return entries[index] ? cloneSnapshot(entries[index]) : null;
    },
    canUndo() {
      return index > 0;
    },
    canRedo() {
      return index >= 0 && index < entries.length - 1;
    },
  };
}
