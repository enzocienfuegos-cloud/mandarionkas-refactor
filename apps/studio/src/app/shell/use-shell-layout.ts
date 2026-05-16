import { useEffect, useState } from 'react';
import { readScopedStorageItem, writeScopedStorageItem } from '../../shared/browser/storage';

export const SHELL_LAYOUT_STORAGE_KEY = 'smx.studio.shell.layout.v2';

export type ShellLayout = {
  leftRailWidth: number;
  rightInspectorWidth: number;
  timelineHeight: number;
  leftRailHidden: boolean;
  rightInspectorHidden: boolean;
  timelineHidden: boolean;
};

export const DEFAULT_SHELL_LAYOUT: ShellLayout = {
  leftRailWidth: 288,
  rightInspectorWidth: 328,
  timelineHeight: 220,
  leftRailHidden: false,
  rightInspectorHidden: false,
  timelineHidden: false,
};

export const LEFT_RAIL_MIN_WIDTH = 200;
export const LEFT_RAIL_MAX_WIDTH = 520;
export const RIGHT_INSPECTOR_MIN_WIDTH = 280;
export const RIGHT_INSPECTOR_MAX_WIDTH = 520;
export const TIMELINE_MIN_HEIGHT = 140;
export const TIMELINE_MAX_HEIGHT = 480;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function asFiniteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

export function normalizeShellLayout(value: unknown): ShellLayout {
  if (!value || typeof value !== 'object') return DEFAULT_SHELL_LAYOUT;
  const partial = value as Partial<ShellLayout>;
  return {
    leftRailWidth: clamp(asFiniteNumber(partial.leftRailWidth) ?? DEFAULT_SHELL_LAYOUT.leftRailWidth, LEFT_RAIL_MIN_WIDTH, LEFT_RAIL_MAX_WIDTH),
    rightInspectorWidth: clamp(
      asFiniteNumber(partial.rightInspectorWidth) ?? DEFAULT_SHELL_LAYOUT.rightInspectorWidth,
      RIGHT_INSPECTOR_MIN_WIDTH,
      RIGHT_INSPECTOR_MAX_WIDTH,
    ),
    timelineHeight: clamp(asFiniteNumber(partial.timelineHeight) ?? DEFAULT_SHELL_LAYOUT.timelineHeight, TIMELINE_MIN_HEIGHT, TIMELINE_MAX_HEIGHT),
    leftRailHidden: asBoolean(partial.leftRailHidden, DEFAULT_SHELL_LAYOUT.leftRailHidden),
    rightInspectorHidden: asBoolean(partial.rightInspectorHidden, DEFAULT_SHELL_LAYOUT.rightInspectorHidden),
    timelineHidden: asBoolean(partial.timelineHidden, DEFAULT_SHELL_LAYOUT.timelineHidden),
  };
}

export function readShellLayout(): ShellLayout {
  try {
    const raw = readScopedStorageItem(SHELL_LAYOUT_STORAGE_KEY, '');
    if (!raw) return DEFAULT_SHELL_LAYOUT;
    return normalizeShellLayout(JSON.parse(raw));
  } catch {
    return DEFAULT_SHELL_LAYOUT;
  }
}

export function writeShellLayout(layout: ShellLayout): void {
  writeScopedStorageItem(SHELL_LAYOUT_STORAGE_KEY, JSON.stringify(normalizeShellLayout(layout)));
}

export function useShellLayout() {
  const [layout, setLayout] = useState<ShellLayout>(() => readShellLayout());

  useEffect(() => {
    writeShellLayout(layout);
  }, [layout]);

  return [layout, setLayout] as const;
}
