import type { KeyframeEasing, KeyframeNode, WidgetFrame, WidgetTimeline } from '../../domain/document/types';

/** @deprecated removed in Phase 2 */
export function motionKeyframe(
  id: string,
  property: KeyframeNode['property'],
  atMs: number,
  value: number,
  easing: KeyframeEasing,
): KeyframeNode {
  return { id, property, atMs: Math.round(atMs), value, easing };
}

/** @deprecated removed in Phase 2 */
export function clampTimelineMs(atMs: number, timeline: WidgetTimeline): number {
  return Math.max(timeline.startMs, Math.min(timeline.endMs, atMs));
}

/** @deprecated removed in Phase 2 */
export function buildFadeInKeyframes(
  templateId: string,
  timeline: WidgetTimeline,
  durationMs: number,
  delayMs = 0,
  easing: KeyframeEasing = 'ease-out',
): KeyframeNode[] {
  const startAtMs = clampTimelineMs(timeline.startMs + delayMs, timeline);
  const endAtMs = clampTimelineMs(startAtMs + durationMs, timeline);
  return [
    motionKeyframe(`${templateId}:opacity:start`, 'opacity', startAtMs, 0, easing),
    motionKeyframe(`${templateId}:opacity:end`, 'opacity', endAtMs, 1, easing),
  ];
}

/** @deprecated removed in Phase 2 */
export function buildFadeOutKeyframes(
  templateId: string,
  timeline: WidgetTimeline,
  durationMs: number,
  easing: KeyframeEasing = 'ease-in',
): KeyframeNode[] {
  const startAtMs = Math.max(timeline.startMs, timeline.endMs - durationMs);
  return [
    motionKeyframe(`${templateId}:opacity:start`, 'opacity', startAtMs, 1, easing),
    motionKeyframe(`${templateId}:opacity:end`, 'opacity', timeline.endMs, 0, easing),
  ];
}

/** @deprecated removed in Phase 2 */
export function buildTranslateInKeyframes(
  templateId: string,
  property: 'x' | 'y',
  frame: WidgetFrame,
  timeline: WidgetTimeline,
  durationMs: number,
  delayMs: number,
  distancePx: number,
  direction: 1 | -1,
  withFade: boolean,
): KeyframeNode[] {
  const startAtMs = clampTimelineMs(timeline.startMs + delayMs, timeline);
  const endAtMs = clampTimelineMs(startAtMs + durationMs, timeline);
  const baseValue = property === 'x' ? frame.x : frame.y;
  const startValue = baseValue + distancePx * direction;
  const keyframes: KeyframeNode[] = [
    motionKeyframe(`${templateId}:${property}:start`, property, startAtMs, startValue, 'ease-out'),
    motionKeyframe(`${templateId}:${property}:end`, property, endAtMs, baseValue, 'ease-out'),
  ];
  if (withFade) {
    keyframes.push(
      motionKeyframe(`${templateId}:opacity:start`, 'opacity', startAtMs, 0, 'ease-out'),
      motionKeyframe(`${templateId}:opacity:end`, 'opacity', endAtMs, 1, 'ease-out'),
    );
  }
  return keyframes;
}

/** @deprecated removed in Phase 2 */
export function dedupeMotionKeyframes(keyframes: KeyframeNode[]): KeyframeNode[] {
  const deduped = new Map<string, KeyframeNode>();
  keyframes.forEach((keyframe) => {
    deduped.set(`${keyframe.property}:${keyframe.atMs}`, keyframe);
  });
  return [...deduped.values()].sort((left, right) => left.atMs - right.atMs);
}
