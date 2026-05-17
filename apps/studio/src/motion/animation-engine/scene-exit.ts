import type { WidgetMotion } from '../../domain/document/types';
import { DEFAULT_MOTION_DELAY_MS, DEFAULT_MOTION_DURATION_MS } from './constants';

type MotionCarrier = {
  motion?: WidgetMotion;
};

function readMotionNumber(config: Record<string, number | string> | undefined, key: string, fallback: number): number {
  if (!config) return fallback;
  const value = config[key];
  const numeric = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN;
  return Number.isFinite(numeric) ? numeric : fallback;
}

export function resolveSceneExitDurationMs(widgets: readonly MotionCarrier[]): number {
  return widgets.reduce((maxDuration, widget) => {
    const exitSlot = widget.motion?.exit;
    if (!exitSlot || exitSlot.trigger !== 'scene-exit') return maxDuration;
    const delayMs = Math.max(0, readMotionNumber(exitSlot.config, 'delayMs', DEFAULT_MOTION_DELAY_MS));
    const durationMs = Math.max(1, readMotionNumber(exitSlot.config, 'durationMs', DEFAULT_MOTION_DURATION_MS));
    return Math.max(maxDuration, delayMs + durationMs);
  }, 0);
}
