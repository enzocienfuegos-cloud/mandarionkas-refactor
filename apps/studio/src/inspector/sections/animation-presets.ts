import { createId } from '../../domain/document/factories';
import type { KeyframeNode, WidgetNode } from '../../domain/document/types';

export type SupportedAnimationPreset = 'appear' | 'fade-up' | 'fade-out' | 'pulse';
export type HoverMotionPreset = 'none' | 'lift' | 'zoom' | 'pulse';

export type AnimationPresetConfig = {
  preset: SupportedAnimationPreset | '';
  durationMs: number;
  delayMs: number;
  distancePx: number;
  intensity: number;
};

export type HoverMotionConfig = {
  preset: HoverMotionPreset;
  durationMs: number;
  distancePx: number;
  scale: number;
};

const DEFAULT_ANIMATION_DURATION_MS = 700;
const DEFAULT_PULSE_DURATION_MS = 900;
const DEFAULT_ANIMATION_DELAY_MS = 0;
const DEFAULT_ANIMATION_DISTANCE_PX = 24;
const DEFAULT_ANIMATION_INTENSITY = 0.55;

const DEFAULT_HOVER_MOTION_DURATION_MS = 240;
const DEFAULT_HOVER_MOTION_DISTANCE_PX = 12;
const DEFAULT_HOVER_MOTION_SCALE = 1.04;

export const ANIMATION_PRESET_WIDGET_TYPES = new Set<WidgetNode['type']>([
  'text',
  'image',
  'cta',
  'buttons',
  'group',
]);

export function supportsAnimationPresets(widget: WidgetNode): boolean {
  return ANIMATION_PRESET_WIDGET_TYPES.has(widget.type);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function readNumber(value: unknown, fallback: number): number {
  const numeric = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN;
  return Number.isFinite(numeric) ? numeric : fallback;
}

export function getAnimationPresetConfig(widget: WidgetNode): AnimationPresetConfig {
  const rawPreset = String(widget.style.animationPreset ?? '');
  return {
    preset: rawPreset === 'appear' || rawPreset === 'fade-up' || rawPreset === 'fade-out' || rawPreset === 'pulse' ? rawPreset : '',
    durationMs: Math.round(clamp(readNumber(widget.style.animationDurationMs, rawPreset === 'pulse' ? DEFAULT_PULSE_DURATION_MS : DEFAULT_ANIMATION_DURATION_MS), 120, 6000)),
    delayMs: Math.round(clamp(readNumber(widget.style.animationDelayMs, DEFAULT_ANIMATION_DELAY_MS), 0, 6000)),
    distancePx: clamp(readNumber(widget.style.animationDistancePx, DEFAULT_ANIMATION_DISTANCE_PX), 0, 160),
    intensity: clamp(readNumber(widget.style.animationIntensity, DEFAULT_ANIMATION_INTENSITY), 0.1, 1),
  };
}

export function getHoverMotionConfig(widget: WidgetNode): HoverMotionConfig {
  const rawPreset = String(widget.style.hoverMotionPreset ?? 'none');
  return {
    preset: rawPreset === 'lift' || rawPreset === 'zoom' || rawPreset === 'pulse' ? rawPreset : 'none',
    durationMs: Math.round(clamp(readNumber(widget.style.hoverMotionDurationMs, DEFAULT_HOVER_MOTION_DURATION_MS), 120, 3000)),
    distancePx: clamp(readNumber(widget.style.hoverMotionDistancePx, DEFAULT_HOVER_MOTION_DISTANCE_PX), 0, 80),
    scale: clamp(readNumber(widget.style.hoverMotionScale, DEFAULT_HOVER_MOTION_SCALE), 1, 1.4),
  };
}

function buildKeyframe(property: KeyframeNode['property'], atMs: number, value: number, easing?: KeyframeNode['easing']): KeyframeNode {
  return { id: createId('kf'), property, atMs, value, easing };
}

function replacePresetTracks(existing: KeyframeNode[], replacement: KeyframeNode[], tracks: Array<KeyframeNode['property']>): KeyframeNode[] {
  return [
    ...existing.filter((item) => !tracks.includes(item.property)),
    ...replacement,
  ].sort((left, right) => left.atMs - right.atMs);
}

export function applyAnimationPreset(widget: WidgetNode, preset: SupportedAnimationPreset): { keyframes: KeyframeNode[]; stylePatch: Record<string, unknown> } {
  const config = getAnimationPresetConfig({ ...widget, style: { ...widget.style, animationPreset: preset } });
  const startMs = Math.max(0, Number(widget.timeline.startMs ?? 0));
  const endMs = Math.max(startMs + 100, Number(widget.timeline.endMs ?? startMs + 1000));
  const baseOpacity = Number(widget.style.opacity ?? 1);
  const baseY = Number(widget.frame.y ?? 0);
  const durationMs = Math.min(endMs - startMs, config.durationMs);
  const delayedStartMs = Math.min(endMs, startMs + config.delayMs);
  const distancePx = config.distancePx;
  const intensity = config.intensity;
  const existing = widget.timeline.keyframes ?? [];
  const stylePatch = {
    animationPreset: preset,
    animationDurationMs: config.durationMs,
    animationDelayMs: config.delayMs,
    animationDistancePx: config.distancePx,
    animationIntensity: config.intensity,
  };

  if (preset === 'appear') {
    return {
      keyframes: replacePresetTracks(existing, [
        buildKeyframe('opacity', delayedStartMs, 0),
        buildKeyframe('opacity', Math.min(endMs, delayedStartMs + durationMs), baseOpacity, 'ease-out'),
      ], ['opacity']),
      stylePatch,
    };
  }

  if (preset === 'fade-up') {
    return {
      keyframes: replacePresetTracks(existing, [
        buildKeyframe('opacity', delayedStartMs, 0),
        buildKeyframe('opacity', Math.min(endMs, delayedStartMs + durationMs), baseOpacity, 'ease-out'),
        buildKeyframe('y', delayedStartMs, baseY + distancePx),
        buildKeyframe('y', Math.min(endMs, delayedStartMs + durationMs), baseY, 'ease-out'),
      ], ['opacity', 'y']),
      stylePatch,
    };
  }

  if (preset === 'fade-out') {
    const fadeOutStartMs = Math.max(startMs, endMs - durationMs);
    return {
      keyframes: replacePresetTracks(existing, [
        buildKeyframe('opacity', fadeOutStartMs, baseOpacity),
        buildKeyframe('opacity', endMs, 0, 'ease-in'),
      ], ['opacity']),
      stylePatch,
    };
  }

  const pulseDipOpacity = clamp(baseOpacity - intensity * 0.45, 0.15, baseOpacity);
  return {
    keyframes: replacePresetTracks(existing, [
      buildKeyframe('opacity', delayedStartMs, baseOpacity),
      buildKeyframe('opacity', Math.min(endMs, delayedStartMs + Math.round(durationMs * 0.4)), pulseDipOpacity, 'ease-in-out'),
      buildKeyframe('opacity', Math.min(endMs, delayedStartMs + durationMs), baseOpacity, 'ease-in-out'),
    ], ['opacity']),
    stylePatch,
  };
}
