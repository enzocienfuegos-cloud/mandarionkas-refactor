import type { KeyframeNode, WidgetNode } from '../../domain/document/types';

export type SupportedAnimationPreset = 'appear' | 'fade-up' | 'fade-out' | 'pulse';
export type HoverMotionPreset = 'none' | 'lift' | 'zoom' | 'pulse';
export type AnimationRepeatMode = 'once' | 'repeat';

export type AnimationPresetConfig = {
  preset: SupportedAnimationPreset | '';
  durationMs: number;
  delayMs: number;
  distancePx: number;
  intensity: number;
  repeatMode: AnimationRepeatMode;
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
const DEFAULT_ANIMATION_REPEAT_MODE: AnimationRepeatMode = 'once';

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
  const rawRepeatMode = String(widget.style.animationRepeatMode ?? DEFAULT_ANIMATION_REPEAT_MODE);
  return {
    preset: rawPreset === 'appear' || rawPreset === 'fade-up' || rawPreset === 'fade-out' || rawPreset === 'pulse' ? rawPreset : '',
    durationMs: Math.round(clamp(readNumber(widget.style.animationDurationMs, rawPreset === 'pulse' ? DEFAULT_PULSE_DURATION_MS : DEFAULT_ANIMATION_DURATION_MS), 120, 6000)),
    delayMs: Math.round(clamp(readNumber(widget.style.animationDelayMs, DEFAULT_ANIMATION_DELAY_MS), 0, 6000)),
    distancePx: clamp(readNumber(widget.style.animationDistancePx, DEFAULT_ANIMATION_DISTANCE_PX), 0, 160),
    intensity: clamp(readNumber(widget.style.animationIntensity, DEFAULT_ANIMATION_INTENSITY), 0.1, 1),
    repeatMode: rawRepeatMode === 'repeat' ? 'repeat' : 'once',
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

export const PRESET_TRACKS: Array<KeyframeNode['property']> = ['opacity', 'y'];

export function stripPresetManagedKeyframes(keyframes: KeyframeNode[] = []): KeyframeNode[] {
  return keyframes
    .filter((item) => !PRESET_TRACKS.includes(item.property))
    .sort((left, right) => left.atMs - right.atMs);
}

export function applyAnimationPreset(widget: WidgetNode, preset: SupportedAnimationPreset): { keyframes: KeyframeNode[]; stylePatch: Record<string, unknown> } {
  const config = getAnimationPresetConfig({ ...widget, style: { ...widget.style, animationPreset: preset } });
  const existing = stripPresetManagedKeyframes(widget.timeline.keyframes ?? []);
  const stylePatch = {
    animationPreset: preset,
    animationDurationMs: config.durationMs,
    animationDelayMs: config.delayMs,
    animationDistancePx: config.distancePx,
    animationIntensity: config.intensity,
    animationRepeatMode: config.repeatMode,
  };

  return {
    keyframes: existing,
    stylePatch,
  };
}

function applyEasing(progress: number, easing: KeyframeNode['easing'] = 'linear'): number {
  const clamped = clamp(progress, 0, 1);
  if (easing === 'ease-in') return clamped * clamped;
  if (easing === 'ease-out') return 1 - (1 - clamped) * (1 - clamped);
  if (easing === 'ease-in-out') return clamped < 0.5 ? 2 * clamped * clamped : 1 - Math.pow(-2 * clamped + 2, 2) / 2;
  return clamped;
}

export function getAnimationPresetPreviewState(
  widget: WidgetNode,
  playheadMs: number,
): { frame: WidgetNode['frame']; opacity: number } | null {
  const config = getAnimationPresetConfig(widget);
  if (!config.preset) return null;

  const baseFrame = { ...widget.frame };
  const baseOpacity = Number(widget.style.opacity ?? 1);
  const durationMs = Math.max(120, Math.min(Number(widget.timeline.endMs ?? 0) - Number(widget.timeline.startMs ?? 0), config.durationMs));
  if (!Number.isFinite(durationMs) || durationMs <= 0) return { frame: baseFrame, opacity: baseOpacity };

  const startMs = Number(widget.timeline.startMs ?? 0);
  const endMs = Number(widget.timeline.endMs ?? startMs + durationMs);
  const anchorMs = config.preset === 'fade-out'
    ? Math.max(startMs, endMs - durationMs)
    : startMs + config.delayMs;
  const cycleProgress = (currentPlayheadMs: number): number => {
    const elapsedMs = currentPlayheadMs - anchorMs;
    if (config.repeatMode === 'repeat') {
      const normalized = ((elapsedMs % durationMs) + durationMs) % durationMs;
      return clamp(normalized / durationMs, 0, 1);
    }
    return clamp(elapsedMs / durationMs, 0, 1);
  };

  if (config.repeatMode === 'once' && playheadMs < anchorMs) {
    if (config.preset === 'appear') return { frame: baseFrame, opacity: 0 };
    if (config.preset === 'fade-up') return { frame: { ...baseFrame, y: baseFrame.y + config.distancePx }, opacity: 0 };
    return { frame: baseFrame, opacity: baseOpacity };
  }

  const progress = cycleProgress(playheadMs);
  if (config.preset === 'appear') {
    const eased = applyEasing(progress, 'ease-out');
    return { frame: baseFrame, opacity: baseOpacity * eased };
  }

  if (config.preset === 'fade-up') {
    const eased = applyEasing(progress, 'ease-out');
    return {
      frame: { ...baseFrame, y: baseFrame.y + config.distancePx * (1 - eased) },
      opacity: baseOpacity * eased,
    };
  }

  if (config.preset === 'fade-out') {
    if (config.repeatMode === 'once' && playheadMs < anchorMs) return { frame: baseFrame, opacity: baseOpacity };
    const eased = applyEasing(progress, 'ease-in');
    return { frame: baseFrame, opacity: baseOpacity * (1 - eased) };
  }

  const easedIn = progress <= 0.5
    ? applyEasing(progress / 0.5, 'ease-in-out')
    : applyEasing((1 - progress) / 0.5, 'ease-in-out');
  const pulseOpacity = clamp(baseOpacity - config.intensity * 0.45, 0.15, baseOpacity);
  return {
    frame: baseFrame,
    opacity: pulseOpacity + (baseOpacity - pulseOpacity) * easedIn,
  };
}
