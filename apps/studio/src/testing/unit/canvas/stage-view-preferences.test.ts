import { beforeEach, describe, expect, it } from 'vitest';
import {
  EDIT_MODE_WIREFRAME_STORAGE_KEY,
  readEditModeWireframePreference,
  writeEditModeWireframePreference,
} from '../../../canvas/stage/stage-view-preferences';

describe('stage view preferences', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('reads the provided fallback when storage is empty', () => {
    expect(readEditModeWireframePreference()).toBe(false);
    expect(readEditModeWireframePreference(true)).toBe(true);
  });

  it('writes and reads the persisted edit-mode wireframe flag', () => {
    writeEditModeWireframePreference(true);

    expect(localStorage.getItem(EDIT_MODE_WIREFRAME_STORAGE_KEY)).toBe('true');
    expect(readEditModeWireframePreference()).toBe(true);
  });
});
