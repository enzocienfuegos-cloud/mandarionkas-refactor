import { createId } from '../../domain/document/factories';
import type { KeyframeNode, WidgetNode } from '../../domain/document/types';

export type SupportedAnimationPreset = 'appear' | 'fade-up' | 'pulse';

export const ANIMATION_PRESET_WIDGET_TYPES = new Set<WidgetNode['type']>([
  'text',
  'image',
  'cta',
  'buttons',
]);

export function supportsAnimationPresets(widget: WidgetNode): boolean {
  return ANIMATION_PRESET_WIDGET_TYPES.has(widget.type);
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
  const startMs = Math.max(0, Number(widget.timeline.startMs ?? 0));
  const endMs = Math.max(startMs + 100, Number(widget.timeline.endMs ?? startMs + 1000));
  const baseOpacity = Number(widget.style.opacity ?? 1);
  const baseY = Number(widget.frame.y ?? 0);
  const durationMs = Math.min(endMs - startMs, preset === 'pulse' ? 900 : 700);
  const existing = widget.timeline.keyframes ?? [];

  if (preset === 'appear') {
    return {
      keyframes: replacePresetTracks(existing, [
        buildKeyframe('opacity', startMs, 0),
        buildKeyframe('opacity', startMs + durationMs, baseOpacity, 'ease-out'),
      ], ['opacity']),
      stylePatch: { animationPreset: preset },
    };
  }

  if (preset === 'fade-up') {
    return {
      keyframes: replacePresetTracks(existing, [
        buildKeyframe('opacity', startMs, 0),
        buildKeyframe('opacity', startMs + durationMs, baseOpacity, 'ease-out'),
        buildKeyframe('y', startMs, baseY + 24),
        buildKeyframe('y', startMs + durationMs, baseY, 'ease-out'),
      ], ['opacity', 'y']),
      stylePatch: { animationPreset: preset },
    };
  }

  return {
    keyframes: replacePresetTracks(existing, [
      buildKeyframe('opacity', startMs, baseOpacity),
      buildKeyframe('opacity', startMs + Math.round(durationMs * 0.4), Math.max(0.55, baseOpacity * 0.72), 'ease-in-out'),
      buildKeyframe('opacity', startMs + durationMs, baseOpacity, 'ease-in-out'),
    ], ['opacity']),
    stylePatch: { animationPreset: preset },
  };
}
