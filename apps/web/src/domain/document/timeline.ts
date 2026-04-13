import type { KeyframeEasing, KeyframeNode, WidgetNode } from './types';

export { buildTimelineSnapTargets, getTimelineGridStepMs, snapTimelineMs } from '../../shared/timeline-snapping';
export type { TimelineSnapResult, TimelineSnapTarget } from '../../shared/timeline-snapping';

function sortKeyframes(keyframes: KeyframeNode[]): KeyframeNode[] {
  return [...keyframes].sort((a, b) => a.atMs - b.atMs);
}

function applyEasing(progress: number, easing: KeyframeEasing = 'linear'): number {
  const p = Math.max(0, Math.min(1, progress));
  switch (easing) {
    case 'ease-in':
      return p * p;
    case 'ease-out':
      return 1 - (1 - p) * (1 - p);
    case 'ease-in-out':
      return p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
    case 'linear':
    default:
      return p;
  }
}

function interpolateValue(left: KeyframeNode, right: KeyframeNode, playheadMs: number): number {
  if (right.atMs === left.atMs) return left.value;
  const progress = (playheadMs - left.atMs) / (right.atMs - left.atMs);
  const eased = applyEasing(progress, right.easing ?? 'linear');
  return left.value + (right.value - left.value) * eased;
}

export function getLiveWidgetFrame(widget: WidgetNode, playheadMs: number): WidgetNode['frame'] {
  const keyframes = widget.timeline.keyframes ?? [];
  const nextFrame = { ...widget.frame };

  (['x', 'y', 'width', 'height'] as const).forEach((property) => {
    const track = sortKeyframes(keyframes.filter((item) => item.property === property));
    if (!track.length) return;
    const before = [...track].reverse().find((item) => item.atMs <= playheadMs) ?? track[0];
    const after = track.find((item) => item.atMs >= playheadMs) ?? track[track.length - 1];
    nextFrame[property] = interpolateValue(before, after, playheadMs);
  });

  return nextFrame;
}

export function getLiveWidgetOpacity(widget: WidgetNode, playheadMs: number): number {
  const keyframes = sortKeyframes((widget.timeline.keyframes ?? []).filter((item) => item.property === 'opacity'));
  const baseOpacity = Number(widget.style.opacity ?? 1);
  if (!keyframes.length) return baseOpacity;
  const before = [...keyframes].reverse().find((item) => item.atMs <= playheadMs) ?? keyframes[0];
  const after = keyframes.find((item) => item.atMs >= playheadMs) ?? keyframes[keyframes.length - 1];
  return interpolateValue(before, after, playheadMs);
}

export function isWidgetVisibleAt(widget: WidgetNode, playheadMs: number): boolean {
  if (widget.hidden) return false;
  if (widget.timeline.excluded) return true;
  return playheadMs >= widget.timeline.startMs && playheadMs <= widget.timeline.endMs;
}
