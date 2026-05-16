import type { KeyframeNode, WidgetHoverMotion, WidgetMotion, WidgetNode } from '../../domain/document/types';
import {
  buildLegacyHoverMotionStylePatch,
  buildLegacyMotionStylePatch,
  buildWidgetHoverMotion,
  buildWidgetMotion,
  computeWidgetMotionState,
  resolveWidgetHoverMotion,
  resolveWidgetMotion,
} from '../../motion/motion-model';
import { stripMotionManagedKeyframes } from '../../motion/motion-managed-keyframes';
import { listHoverMotionTemplates, listMotionTemplates } from '../../motion/motion-registry';
import { widgetSupportsHoverMotion, widgetSupportsMotion } from '../../motion/motion-widget-compatibility';

export type SupportedAnimationPreset =
  | 'appear'
  | 'fade-in'
  | 'fade-up'
  | 'fade-out'
  | 'pulse'
  | 'float'
  | 'slide-in-left'
  | 'slide-in-right'
  | 'slide-in-up'
  | 'slide-in-down';

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

const DEFAULT_ANIMATION_CONFIG: Omit<AnimationPresetConfig, 'preset'> = {
  durationMs: 700,
  delayMs: 0,
  distancePx: 24,
  intensity: 0.55,
  repeatMode: 'once',
};

const DEFAULT_HOVER_CONFIG: Omit<HoverMotionConfig, 'preset'> = {
  durationMs: 240,
  distancePx: 12,
  scale: 1.04,
};

export const ANIMATION_PRESET_WIDGET_TYPES = new Set<WidgetNode['type']>(['text', 'image', 'cta', 'buttons', 'group']);
export function supportsAnimationPresets(widget: WidgetNode): boolean {
  return widgetSupportsMotion(widget);
}

export function supportsHoverPresets(widget: WidgetNode): boolean {
  return widgetSupportsHoverMotion(widget);
}

export function getAvailableAnimationTemplates(widget: WidgetNode) {
  return listMotionTemplates().filter((template) => widgetSupportsMotion(widget, template));
}

export function getAvailableHoverTemplates(widget: WidgetNode) {
  return listHoverMotionTemplates().filter((template) => widgetSupportsHoverMotion(widget, template));
}

export function getAnimationPresetConfig(widget: WidgetNode): AnimationPresetConfig {
  const selection = resolveWidgetMotion(widget);
  if (!selection) {
    return {
      preset: '',
      durationMs: Number(widget.style.animationDurationMs ?? DEFAULT_ANIMATION_CONFIG.durationMs),
      delayMs: Number(widget.style.animationDelayMs ?? DEFAULT_ANIMATION_CONFIG.delayMs),
      distancePx: Number(widget.style.animationDistancePx ?? DEFAULT_ANIMATION_CONFIG.distancePx),
      intensity: Number(widget.style.animationIntensity ?? DEFAULT_ANIMATION_CONFIG.intensity),
      repeatMode: String(widget.style.animationRepeatMode ?? DEFAULT_ANIMATION_CONFIG.repeatMode) === 'repeat' ? 'repeat' : 'once',
    };
  }
  return {
    preset: selection.template.id as SupportedAnimationPreset,
    durationMs: Number(selection.config.durationMs ?? DEFAULT_ANIMATION_CONFIG.durationMs),
    delayMs: Number(selection.config.delayMs ?? DEFAULT_ANIMATION_CONFIG.delayMs),
    distancePx: Number(selection.config.distancePx ?? DEFAULT_ANIMATION_CONFIG.distancePx),
    intensity: Number(selection.config.intensity ?? DEFAULT_ANIMATION_CONFIG.intensity),
    repeatMode: String(selection.config.repeatMode ?? DEFAULT_ANIMATION_CONFIG.repeatMode) === 'repeat' ? 'repeat' : 'once',
  };
}

export function getHoverMotionConfig(widget: WidgetNode): HoverMotionConfig {
  const selection = resolveWidgetHoverMotion(widget);
  if (!selection) {
    return {
      preset: typeof widget.style.hoverMotionPreset === 'string' && widget.style.hoverMotionPreset !== 'none'
        ? widget.style.hoverMotionPreset as HoverMotionPreset
        : 'none',
      durationMs: Number(widget.style.hoverMotionDurationMs ?? DEFAULT_HOVER_CONFIG.durationMs),
      distancePx: Number(widget.style.hoverMotionDistancePx ?? DEFAULT_HOVER_CONFIG.distancePx),
      scale: Number(widget.style.hoverMotionScale ?? DEFAULT_HOVER_CONFIG.scale),
    };
  }
  return {
    preset: selection.template.id === 'lift' || selection.template.id === 'zoom' || selection.template.id === 'pulse' ? selection.template.id : 'none',
    durationMs: Number(selection.config.durationMs ?? DEFAULT_HOVER_CONFIG.durationMs),
    distancePx: Number(selection.config.distancePx ?? DEFAULT_HOVER_CONFIG.distancePx),
    scale: Number(selection.config.scale ?? DEFAULT_HOVER_CONFIG.scale),
  };
}

export function applyAnimationPreset(
  widget: WidgetNode,
  preset: SupportedAnimationPreset,
): {
  keyframes: KeyframeNode[];
  stylePatch: Record<string, unknown>;
  motion: WidgetMotion | undefined;
} {
  const currentConfig = getAnimationPresetConfig(widget);
  const motion = buildWidgetMotion(preset, {
    durationMs: currentConfig.durationMs,
    delayMs: currentConfig.delayMs,
    distancePx: currentConfig.distancePx,
    intensity: currentConfig.intensity,
    repeatMode: currentConfig.repeatMode,
  });
  return {
    keyframes: stripMotionManagedKeyframes(widget.timeline.keyframes ?? []),
    stylePatch: buildLegacyMotionStylePatch(motion),
    motion,
  };
}

export function buildHoverMotionPreset(
  widget: WidgetNode,
  preset: HoverMotionPreset,
): {
  stylePatch: Record<string, unknown>;
  hoverMotion: WidgetHoverMotion | undefined;
} {
  const currentConfig = getHoverMotionConfig(widget);
  const hoverMotion = preset === 'none'
    ? undefined
    : buildWidgetHoverMotion(preset, {
      durationMs: currentConfig.durationMs,
      distancePx: currentConfig.distancePx,
      scale: currentConfig.scale,
    });
  return {
    stylePatch: buildLegacyHoverMotionStylePatch(hoverMotion),
    hoverMotion,
  };
}

function extractTranslateOffset(transform: string): { x: number; y: number } {
  const xMatch = transform.match(/translateX\((-?[0-9.]+)px\)/);
  const yMatch = transform.match(/translateY\((-?[0-9.]+)px\)/);
  return {
    x: xMatch ? Number(xMatch[1]) : 0,
    y: yMatch ? Number(yMatch[1]) : 0,
  };
}

export function getAnimationPresetPreviewState(
  widget: WidgetNode,
  playheadMs: number,
): { frame: WidgetNode['frame']; opacity: number } | null {
  const state = computeWidgetMotionState(widget, playheadMs, Number(widget.style.opacity ?? 1));
  if (!state) return null;
  const offset = extractTranslateOffset(state.transform);
  return {
    frame: {
      ...widget.frame,
      x: widget.frame.x + offset.x,
      y: widget.frame.y + offset.y,
    },
    opacity: state.opacity,
  };
}
