import type { StudioState } from '../../domain/document/types';

export function createPersistenceSnapshot(state: StudioState): StudioState {
  return {
    document: {
      ...state.document,
      metadata: {
        ...state.document.metadata,
        dirty: state.document.metadata.dirty,
        lastSavedAt: state.document.metadata.lastSavedAt,
        lastAutosavedAt: undefined,
      },
    },
    ui: {
      ...state.ui,
      playheadMs: 0,
      isPlaying: false,
      previewMode: false,
      hoveredWidgetId: undefined,
      activeWidgetId: undefined,
      inspectorFocus: undefined,
      lastTriggeredActionLabel: undefined,
    },
  };
}

function areRecordsEqual(left: Record<string, unknown>, right: Record<string, unknown>): boolean {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) return false;
  for (const key of leftKeys) {
    if (!Object.prototype.hasOwnProperty.call(right, key)) return false;
    if (!arePersistenceValuesEqual(left[key], right[key])) return false;
  }
  return true;
}

export function arePersistenceValuesEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (left === null || right === null) return left === right;
  if (typeof left !== typeof right) return false;
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right)) return false;
    if (left.length !== right.length) return false;
    for (let index = 0; index < left.length; index += 1) {
      if (!arePersistenceValuesEqual(left[index], right[index])) return false;
    }
    return true;
  }
  if (typeof left !== 'object' || typeof right !== 'object') return false;
  return areRecordsEqual(left as Record<string, unknown>, right as Record<string, unknown>);
}

export function arePersistenceSnapshotsEqual(left: StudioState, right: StudioState): boolean {
  return arePersistenceValuesEqual(createPersistenceSnapshot(left), createPersistenceSnapshot(right));
}
