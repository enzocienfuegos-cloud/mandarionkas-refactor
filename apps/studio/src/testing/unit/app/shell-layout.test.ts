import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_SHELL_LAYOUT,
  SHELL_LAYOUT_STORAGE_KEY,
  normalizeShellLayout,
  readShellLayout,
  writeShellLayout,
} from '../../../app/shell/use-shell-layout';

describe('shell layout persistence', () => {
  beforeEach(() => {
    globalThis.localStorage.clear();
  });

  it('normalizes persisted layout values into allowed ranges', () => {
    const normalized = normalizeShellLayout({
      leftRailWidth: 999,
      rightInspectorWidth: 120,
      timelineHeight: 90,
      leftRailHidden: true,
      rightInspectorHidden: 'nope',
      timelineHidden: true,
    });

    expect(normalized).toEqual({
      leftRailWidth: 520,
      rightInspectorWidth: 280,
      timelineHeight: 140,
      leftRailHidden: true,
      rightInspectorHidden: false,
      timelineHidden: true,
    });
  });

  it('reads defaults when storage is empty or invalid', () => {
    expect(readShellLayout()).toEqual(DEFAULT_SHELL_LAYOUT);

    localStorage.setItem(SHELL_LAYOUT_STORAGE_KEY, '{broken json');

    expect(readShellLayout()).toEqual(DEFAULT_SHELL_LAYOUT);
  });

  it('writes a normalized snapshot to browser storage', () => {
    writeShellLayout({
      leftRailWidth: 180,
      rightInspectorWidth: 999,
      timelineHeight: 300,
      leftRailHidden: false,
      rightInspectorHidden: true,
      timelineHidden: false,
    });

    expect(JSON.parse(localStorage.getItem(SHELL_LAYOUT_STORAGE_KEY) ?? 'null')).toEqual({
      leftRailWidth: 200,
      rightInspectorWidth: 520,
      timelineHeight: 300,
      leftRailHidden: false,
      rightInspectorHidden: true,
      timelineHidden: false,
    });
  });
});
