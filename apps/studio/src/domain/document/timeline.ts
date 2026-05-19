import type { KeyframeEasing, KeyframeNode, WidgetNode } from './types';

export { buildTimelineSnapTargets, getTimelineGridStepMs, snapTimelineMs } from '../../shared/timeline-snapping';
export type { TimelineSnapResult, TimelineSnapTarget } from '../../shared/timeline-snapping';

type SortedKeyframeTracks = {
  x: KeyframeNode[];
  y: KeyframeNode[];
  width: KeyframeNode[];
  height: KeyframeNode[];
  opacity: KeyframeNode[];
};

const tracksCache = new WeakMap<WidgetNode, SortedKeyframeTracks>();

function getSortedTracks(widget: WidgetNode): SortedKeyframeTracks {
  const cached = tracksCache.get(widget);
  if (cached) return cached;

  const tracks: SortedKeyframeTracks = {
    x: [],
    y: [],
    width: [],
    height: [],
    opacity: [],
  };

  for (const keyframe of widget.timeline.keyframes ?? []) {
    const bucket = tracks[keyframe.property as keyof SortedKeyframeTracks];
    if (bucket) bucket.push(keyframe);
  }

  tracks.x.sort((a, b) => a.atMs - b.atMs);
  tracks.y.sort((a, b) => a.atMs - b.atMs);
  tracks.width.sort((a, b) => a.atMs - b.atMs);
  tracks.height.sort((a, b) => a.atMs - b.atMs);
  tracks.opacity.sort((a, b) => a.atMs - b.atMs);
  tracksCache.set(widget, tracks);
  return tracks;
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

function findKeyframeBefore(track: KeyframeNode[], playheadMs: number): KeyframeNode | undefined {
  if (!track.length) return undefined;
  let low = 0;
  let high = track.length - 1;
  let found: KeyframeNode | undefined;

  while (low <= high) {
    const mid = (low + high) >>> 1;
    const keyframe = track[mid];
    if (keyframe.atMs <= playheadMs) {
      found = keyframe;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return found ?? track[0];
}

function findKeyframeAfter(track: KeyframeNode[], playheadMs: number): KeyframeNode | undefined {
  if (!track.length) return undefined;
  let low = 0;
  let high = track.length - 1;
  let found: KeyframeNode | undefined;

  while (low <= high) {
    const mid = (low + high) >>> 1;
    const keyframe = track[mid];
    if (keyframe.atMs >= playheadMs) {
      found = keyframe;
      high = mid - 1;
    } else {
      low = mid + 1;
    }
  }

  return found ?? track[track.length - 1];
}

export function getLiveWidgetFrame(widget: WidgetNode, playheadMs: number): WidgetNode['frame'] {
  const tracks = getSortedTracks(widget);
  let x = widget.frame.x;
  let y = widget.frame.y;
  let width = widget.frame.width;
  let height = widget.frame.height;

  if (tracks.x.length) {
    const before = findKeyframeBefore(tracks.x, playheadMs);
    const after = findKeyframeAfter(tracks.x, playheadMs);
    if (before && after) x = interpolateValue(before, after, playheadMs);
  }
  if (tracks.y.length) {
    const before = findKeyframeBefore(tracks.y, playheadMs);
    const after = findKeyframeAfter(tracks.y, playheadMs);
    if (before && after) y = interpolateValue(before, after, playheadMs);
  }
  if (tracks.width.length) {
    const before = findKeyframeBefore(tracks.width, playheadMs);
    const after = findKeyframeAfter(tracks.width, playheadMs);
    if (before && after) width = interpolateValue(before, after, playheadMs);
  }
  if (tracks.height.length) {
    const before = findKeyframeBefore(tracks.height, playheadMs);
    const after = findKeyframeAfter(tracks.height, playheadMs);
    if (before && after) height = interpolateValue(before, after, playheadMs);
  }

  if (
    x === widget.frame.x
    && y === widget.frame.y
    && width === widget.frame.width
    && height === widget.frame.height
  ) {
    return widget.frame;
  }

  return { ...widget.frame, x, y, width, height };
}

export function getLiveWidgetOpacity(widget: WidgetNode, playheadMs: number): number {
  const baseOpacity = Number(widget.style.opacity ?? 1);
  const tracks = getSortedTracks(widget);
  if (!tracks.opacity.length) return baseOpacity;
  const before = findKeyframeBefore(tracks.opacity, playheadMs);
  const after = findKeyframeAfter(tracks.opacity, playheadMs);
  if (!before || !after) return baseOpacity;
  return interpolateValue(before, after, playheadMs);
}

export function isWidgetVisibleAt(widget: WidgetNode, playheadMs: number): boolean {
  if (widget.hidden) return false;
  return playheadMs >= widget.timeline.startMs && playheadMs <= widget.timeline.endMs;
}
